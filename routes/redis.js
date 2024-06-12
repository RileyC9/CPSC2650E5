import redis from "redis";

// Redis
let redisClient;

(async () => {
  redisClient = redis.createClient();

  redisClient.on("error", (error) => console.error(`Error : ${error}`));

  await redisClient.connect();
})();

const first10MoviesRedis = async (redisKey) => {
  try {
    const cachedResult = await redisClient.get(redisKey);
    return cachedResult;
  } catch (e) {
    console.log(e);
  } finally {
    redisClient.disconnect();
  }
}

const postRedis = async (key, time, content, conditions) => {
  redisClient.setEx(key, time, content, conditions);
}



export { first10MoviesRedis, postRedis };
