import "dotenv/config.js";
import redis from "redis";
import { MongoClient, ObjectId } from "mongodb";
import createError from "http-errors";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import indexRouter from "./routes/index.js";

// Constants
const port = process.env.PORT || 3000;
console.log("check");

// Create http server
const app = express();

// view engine setup
app.set("views", path.join("views"));
app.set("view engine", "pug");
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join("public")));
app.get("/mongo", (req,res)=> {
    first10Movies(req,res);
})
app.get("/mongo/:id", (req, res) => {
movieByID(req, res);
})
app.patch("/mongo/:id", (req, res) => {
  movieByIdAndUpdate(req, res);
})
app.delete("/mongo/:id", (req, res) => {
  deleteMovieByID(req, res);
})
app.use("/", indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

// Start http server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});

// Redis
let redisClient;

(async () => {
  redisClient = redis.createClient();

  redisClient.on("error", (error) => console.error(`Error : ${error}`));

  await redisClient.connect();
})();

// Express
const router = express.Router();
// router.use(express.urlencoded({ extended: true }));
router.use(express.json());

//MongoDB
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

async function first10Movies(req, res) {
  try {
    let redisKey = req.body.redisKey;
    let result;
    let isCached = false;
    
    const cachedResult = await redisClient.get(redisKey);
    if (cachedResult) {
      console.log("First 10 movies from Redis:");
      result = JSON.parse(cachedResult);
      console.log(result);
      isCached = true;
    } else {
      await client.connect();
      console.log("Connected to the MongoDB database");
      const db = client.db(process.env.MONGODBNAME);
      result = await db
        .collection("movies")
        .find()
        .limit(10)
        .project({ title: 1 })
        .toArray();
      console.log("First 10 movies:")
      console.log(result);
      await redisClient.setEx(redisKey, 3600, JSON.stringify(result), {
        EX: 180,
        NX: true,
      });
      isCached = true;
      console.log(`Cached. Key: ${redisKey}`)
      debugger;
    }
    return res.send({
      fromCache: isCached,
      data: result,
    });
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
  } finally {
    await client.close();
  }
}

async function movieByID(req, res) {
  try {
    let redisKey = req.params.id;
    let result;
    let isCached = false;

    const cachedResult = await redisClient.get(redisKey);
    if (cachedResult) {
      result = JSON.parse(cachedResult);
      console.log(`Movie with ID ${redisKey} from Redis:`);
      console.log(result);
      isCached = true;
    } else {
      await client.connect();
      console.log("Connected to the MongoDB database");
      const db = client.db(process.env.MONGODBNAME);
      result = await db
        .collection("movies")
        .findOne({ _id: new ObjectId(redisKey)});
      console.log(`Movie with ID ${redisKey}:`)
      console.log(result);
      await redisClient.setEx(redisKey, 3600, JSON.stringify(result), {
        EX: 180,
        NX: true,
      });
      console.log(`Cached. Key: ${redisKey}`);
      isCached = true;
    }
    debugger;
    return res.send({
      fromCache: isCached,
      data: result,
    });
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
  } finally {
    await client.close();
  }
}

async function movieByIdAndUpdate(req, res) {
  try {
    await client.connect();
    console.log("Connected to the MongoDB database");
    const db = client.db(process.env.MONGODBNAME);

    let result;
    let redisKey = req.params.id;
    let isCached = false;

    result = await db
      .collection("movies")
      .findOneAndUpdate({ _id: new ObjectId(redisKey)}, {$set: { title: redisKey}}, { returnDocument: "after" });
    console.log(`Movie with ID ${redisKey}'s name has been updated to ${redisKey}`);
    console.log(result);

    let redisKeyExit = await redisClient.get(redisKey);
    if (redisKeyExit) {
      redisClient.del(redisKey);
      redisClient.setEx(redisKey, 3600, JSON.stringify(result));
      console.log(`Movie id ${redisKey} has been updated.`);
      isCached = true;
    } else {
      redisClient.setEx(redisKey, 3600, JSON.stringify(result), {
        EX: 180,
        NX: true,
      });
      isCached = true;
      console.log(`Movie id ${redisKey} has been created.`);
    }
    debugger;
    return res.send({
      fromCache: isCached,
      data: result,
    });
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
  } finally {
    await client.close();
  }
}

async function deleteMovieByID(req, res) {
  try {
    await client.connect();
    console.log("Connected to the MongoDB database");

    const db = client.db(process.env.MONGODBNAME);

    let redisKey = req.params.id;

    const result = await db
      .collection("movies")
      .deleteOne({ _id: new ObjectId(redisKey)});
    console.log(`Movie with ID ${redisKey}:`)
    console.log(result);

    let redisKeyExist = await redisClient.get(redisKey);
    if (redisKeyExist) {
      redisClient.del(redisKey);
      console.log(`Movie with id ${id} has been deleted.`)
      redisClient.get(redisKey);
    }
    debugger;
    return res.send( {
      data: result
    })
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
  } finally {
    await client.close();
  }
}