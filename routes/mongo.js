import {MongoClient, ObjectId} from "mongodb";
import "dotenv/config.js";
import redis from "redis";
import { first10MoviesRedis, postRedis } from "./redis.js";
import express from "express";

// Express
const router = express.Router();
// router.use(express.urlencoded({ extended: true }));
router.use(express.json());

//MongoDB
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

async function first10Movies(req, res) {
  try {
    await client.connect();
    console.log("Connected to the MongoDB database");
    // let redisKey = "first10Movies";
    let redisKey = req.body.redisKey;
    let result;
    const db = client.db(process.env.MONGODBNAME);
    let cachedResult = await first10MoviesRedis(redisKey);
    if (cachedResult) {
      console.log("First 10 movies from Redis:");
      result = JSON.parse(cachedResult);
      console.log(result)
    } else {
      result = await db
        .collection("movies")
        .find()
        .limit(10)
        .project({ title: 1 })
        .toArray();
      console.log("First 10 movies:")
      console.log(result);
      await postRedis(redisKey, 3600, JSON.stringify(result), {
        EX: 180,
        NX: true,
      });
      console.log(`Cached. Key: ${redisKey}`)
      debugger;
    }
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
  } finally {
    await client.close();
  }
}

async function movieByID(id) {
  try {
    await client.connect();
    console.log("Connected to the MongoDB database");
    const db = client.db(process.env.MONGODBNAME);

    let redisKey = id;
    let result;

    const cachedResult = await redisClient.get(redisKey);
    if (cachedResult) {
      result = JSON.parse(cachedResult);
      console.log(`Movie with ID ${id} from Redis:`);
      console.log(result);
    } else {
      result = await db
        .collection("movies")
        .findOne({ _id: new ObjectId(id)});
      console.log(`Movie with ID ${id}:`)
      console.log(result);
      await redisClient.setEx(redisKey, 3600, JSON.stringify(result), {
        EX: 180,
        NX: true,
      });
      console.log(`Cached. Key: ${redisKey}`);
    }
    
    debugger;
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
  } finally {
    await client.close();
  }
}

async function movieByIdAndUpdate(id) {
  try {
    await client.connect();
    console.log("Connected to the MongoDB database");
    const db = client.db(process.env.MONGODBNAME);

    let result;
    result = await db
      .collection("movies")
      .findOneAndUpdate({ _id: new ObjectId(id)}, {$set: { title: id}}, { returnDocument: "after" });
    console.log(`Movie with ID ${id}'s name has been updated to ${id}`);
    console.log(result);

    let redisKey = id;

    let redisKeyExit = await redisClient.get(redisKey);
    // console.log(test);
    if (redisKeyExit) {
      redisClient.del(redisKey);
      redisClient.setEx(redisKey, 3600, JSON.stringify(result));
      console.log(`Movie id ${redisKey} has been updated.`);
    } else {
      redisClient.setEx(redisKey, 3600, JSON.stringify(result), {
        EX: 180,
        NX: true,
      });
      console.log(`Movie id ${redisKey} has been created.`);
    }
    
    debugger;
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
  } finally {
    await client.close();
  }
}

async function deleteMovieByID(id) {
  try {
    await client.connect();
    console.log("Connected to the MongoDB database");

    const db = client.db(process.env.MONGODBNAME);

    let redisKey = id;

    const movies = await db
      .collection("movies")
      .deleteOne({ _id: new ObjectId(id)});
    console.log(`Movie with ID ${id}:`)
    console.log(movies);

    let redisKeyExist = await redisClient.get(redisKey);
    if (redisKeyExist) {
      redisClient.del(redisKey);
      console.log(`Movie with id ${id} has been deleted.`)
      redisClient.get(redisKey);
    }
    debugger;
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
  } finally {
    await client.close();
  }
}

await first10Movies();
// await movieByID("573a1390f29313caabcd50e5");
// await movieByIdAndUpdate("573a1390f29313caabcd50e5");
// await deleteMovieByID("573a1390f29313caabcd56df");

router.get('/', (req, res) => {first10Movies(req,res)});

export default router;