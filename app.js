const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const JWT = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");

const app = express();
app.use(express.json());
let db = null;

// Authentication with JWT Token

const authentication = (request, response, next) => {
  //   console.log("im entered");
  const jwtToken = request.headers.authorization;
  //   console.log(request.headers);
  //   console.log(jwtToken);
  try {
    if (jwtToken !== undefined) {
      const jwtTokenPart = jwtToken.split(" ")[1];
      //   console.log(jwtTokenPart);
      JWT.verify(jwtTokenPart, "im unique", (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.payload = payload;
          next();
        }
      });
    } else {
      response.status(401);
      response.send("Invalid JWT Token");
    }
  } catch (e) {
    console.log(e.message);
  }
};

// get "/tweets/"

app.get("/tweets/", async (request, response) => {
  const tweetsQuery = `
    SELECT *
    FROM tweet
    ORDER BY user_id
    `;
  const tweetDetails = await db.all(tweetsQuery);
  response.send(tweetDetails);
});

// "/likes/"

app.get("/likes/", async (request, response) => {
  const tweetsQuery = `
    SELECT *
    FROM like
    `;
  const tweetDetails = await db.all(tweetsQuery);
  response.send(tweetDetails);
});

// "/replies/"

app.get("/replies/", async (request, response) => {
  const tweetsQuery = `
    SELECT *
    FROM reply
    `;
  const tweetDetails = await db.all(tweetsQuery);
  response.send(tweetDetails);
});

// GET "/user/tweets/" API

app.get("/user/tweets/", authentication, async (request, response) => {
  const { username } = request.payload;
  try {
    const getTweetsQuery = `
      SELECT tweet, COUNT(like.like_id) AS likes,
      date_time AS dateTime
      FROM tweet
      JOIN like
      ON tweet.tweet_id = like.tweet_id
      WHERE tweet.tweet_id IN (
          SELECT tweet.tweet_id
          FROM user
          JOIN tweet
          ON user.user_id = tweet.user_id
          WHERE username = '${username}'
      )
      GROUP BY tweet.tweet_id
      `;
    const tweetDetails = await db.all(getTweetsQuery);

    const getTweetsReplyQuery = `
      SELECT COUNT(reply.reply_id) AS replies
      FROM tweet
      JOIN reply
      ON tweet.tweet_id = reply.tweet_id
      WHERE tweet.tweet_id IN (
          SELECT tweet.tweet_id
          FROM user
          JOIN tweet
          ON user.user_id = tweet.user_id
          WHERE username = '${username}'
      )
      GROUP BY tweet.tweet_id
      `;
    const tweetReplyDetails = await db.all(getTweetsReplyQuery);

    let outputObj = [];
    for (let i = 0; i < tweetDetails.length; i++) {
      let obj = {
        tweet: tweetDetails[i].tweet,
        likes: tweetDetails[i].likes,
        replies: tweetReplyDetails[i].replies,
        dateTime: tweetDetails[i].dateTime,
      };
      outputObj.push(obj);
    }
    response.send(outputObj);
  } catch (e) {
    console.log(e.message);
  }
});

// get followers
app.get("/follower/", async (request, response) => {
  try {
    const getTweetsQuery = `
      SELECT * 
      FROM follower
      `;
    const tweetDetails = await db.all(getTweetsQuery);
    response.send(tweetDetails);
  } catch (e) {
    console / log(e.message);
  }
});

// get users

app.get("/users/", async (request, response) => {
  try {
    const getTweetsQuery = `
      SELECT * 
      FROM user
      `;
    const tweetDetails = await db.all(getTweetsQuery);
    response.send(tweetDetails);
  } catch (e) {
    console / log(e.message);
  }
});

// POST /register/ API

app.post("/register/", async (request, response) => {
  //   console.log(request.body);
  const { username, password, name, gender } = request.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}'
        `;
    const userDetails = await db.get(userQuery);
    // console.log(userDetails);
    if (userDetails !== undefined) {
      response.status(400);
      response.send("User already exists");
    } else {
      if (password.length < 6) {
        response.status(400);
        response.send("Password is too short");
      } else {
        const addUserQuery = `
                INSERT INTO user(username,password,name,gender)
                VALUES(
                    '${username}',
                    '${hashedPassword}',
                    '${name}',
                    '${gender}'
                )
                `;
        await db.run(addUserQuery);
        response.send("User created successfully");
      }
    }
  } catch (e) {
    console.log(e.message);
  }
});

// POST /login/ API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  try {
    const hashedPassword = bcrypt.hash(password, 10);
    const userQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}'
        `;
    const userDetails = await db.get(userQuery);
    if (userDetails === undefined) {
      response.status(400);
      response.send("Invalid user");
    } else {
      const passwordCheck = await bcrypt.compare(
        password,
        userDetails.password
      );
      const payload = { username };
      if (passwordCheck) {
        const jwtToken = await JWT.sign(payload, "im unique");
        response.send({
          jwtToken: `${jwtToken}`,
          userID: `${userDetails.user_id}`,
        });
      } else {
        response.status(400);
        response.send("Invalid password");
      }
    }
  } catch (e) {
    console.log(e.message);
  }
});

// GET /user/tweets/feed/ API

app.get("/user/tweets/feed/", authentication, async (request, response) => {
  const { username } = request.payload;
  try {
    const getTweetQuery = `
    SELECT user.username, tweet,date_time AS dateTime
    FROM tweet
    JOIN user
    ON tweet.user_id= user.user_id
    WHERE user.user_id IN (
        SELECT follower.following_user_id
        FROM user 
        JOIN follower
        ON user.user_id = follower.follower_user_id
        where user.username like '${username}'
    )
    ORDER BY date_time DESC
    LIMIT 4;
    `;
    const tweetDetails = await db.all(getTweetQuery);
    response.send(tweetDetails);
  } catch (e) {
    console.log(e.message);
  }
});

// get /user/following/ API

app.get("/user/following/", authentication, async (request, response) => {
  const { username } = request.payload;
  try {
    getFollowingQuery = `
        SELECT DISTINCT name
        FROM user
        JOIN follower
        ON user.user_id = follower.following_user_id
        WHERE follower.following_user_id IN (
            SELECT  follower.following_user_id
            FROM user
            JOIN follower 
            ON user.user_id = follower.follower_user_id
            WHERE user.username = '${username}'
        )
        ORDER BY user.user_id
        `;
    const followingDetails = await db.all(getFollowingQuery);
    response.send(followingDetails);
  } catch (e) {
    console.log(e.message);
  }
});

// /user/followers/ API

app.get("/user/followers/", authentication, async (request, response) => {
  const { username } = request.payload;
  try {
    const getFollowerQuery = `
        SELECT DISTINCT name
        FROM user 
        JOIN follower
        ON user.user_id = follower.follower_user_id
        WHERE follower.follower_user_id IN (
            SELECT follower.follower_user_id
            FROM user
            join follower
            ON user.user_id = follower.following_user_id
            WHERE user.username = '${username}'
        )
        `;
    const followerDetails = await db.all(getFollowerQuery);
    response.send(followerDetails);
  } catch (e) {
    console.log(e.message);
  }
});

// /tweets/:tweetId/ API

app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { username } = request.payload;
  const { tweetId } = request.params;
  try {
    const tweetDetailsQuery = `
      SELECT tweet,count(like.like_id) AS likes,
      tweet.date_time AS dateTime
      FROM tweet
      JOIN user
      ON tweet.user_id = user.user_id
      JOIN like 
      ON tweet.tweet_id = like.tweet_id
      WHERE user.user_id IN(
          SELECT follower.following_user_id
          FROM user
          JOIN follower
          ON user.user_id = follower.follower_user_id
          WHERE user.username = '${username}'
      )
      AND tweet.tweet_id = ${tweetId}
      `;
    const tweetDetails = await db.get(tweetDetailsQuery);

    const tweetReplyDetailsQuery = `
      SELECT count(reply.reply_id) AS replies
      FROM tweet
      JOIN user
      ON tweet.user_id = user.user_id
      JOIN reply 
      ON tweet.tweet_id = reply.tweet_id
      WHERE user.user_id IN(
          SELECT follower.following_user_id
          FROM user
          JOIN follower
          ON user.user_id = follower.follower_user_id
          WHERE user.username = '${username}'
      )
      AND tweet.tweet_id = ${tweetId}
      `;
    const tweetReplyDetails = await db.get(tweetReplyDetailsQuery);

    if (tweetDetails.tweet !== null) {
      response.send({
        tweet: tweetDetails.tweet,
        likes: tweetDetails.likes,
        replies: tweetReplyDetails.replies,
        dateTime: tweetDetails.dateTime,
      });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  } catch (e) {
    console.log(e.message);
  }
});

// "/tweets/:tweetId/likes/" API

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    const { username } = request.payload;
    const { tweetId } = request.params;
    try {
      const tweetDetailsQuery = `
      SELECT like.user_id,tweet
      FROM tweet
      JOIN user
      ON tweet.user_id = user.user_id
      JOIN like
      ON tweet.tweet_id = like.tweet_id
      WHERE user.user_id IN(
          SELECT follower.following_user_id
          FROM user
          JOIN follower
          ON user.user_id = follower.follower_user_id
          WHERE user.username = '${username}'
      )
      AND tweet.tweet_id = ${tweetId}
      `;
      const tweetDetails = await db.all(tweetDetailsQuery);
      console.log(tweetDetails);

      const userIdList = [];

      tweetDetails.forEach((obj) => {
        userIdList.push(obj.user_id);
      });

      const userDetailsQuery = `
      SELECT username
      FROM user
      WHERE user_id IN (${userIdList})
      ORDER BY user_Id
      `;
      const userDetails = await db.all(userDetailsQuery);
      let nameList = [];

      userDetails.forEach((obj) => {
        nameList.push(obj.username);
      });

      if (tweetDetails.length !== 0) {
        response.send({
          likes: nameList,
        });
      } else {
        response.status(401);
        response.send("Invalid Request");
      }
    } catch (e) {
      console.log(e.message);
    }
  }
);

// "/tweets/:tweetId/replies/" API

app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { username } = request.payload;
    const { tweetId } = request.params;
    try {
      const tweetDetailsQuery = `
      SELECT reply.user_id,tweet
      FROM tweet
      JOIN user
      ON tweet.user_id = user.user_id
      JOIN reply
      ON tweet.tweet_id = reply.tweet_id
      WHERE user.user_id IN(
          SELECT follower.following_user_id
          FROM user
          JOIN follower
          ON user.user_id = follower.follower_user_id
          WHERE user.username = '${username}'
      )
      AND tweet.tweet_id = ${tweetId}
      `;
      const tweetDetails = await db.all(tweetDetailsQuery);
      console.log(tweetDetails);

      const userIdList = [];

      tweetDetails.forEach((obj) => {
        userIdList.push(obj.user_id);
      });

      const userDetailsQuery = `
      SELECT name,reply
      FROM user
      JOIN reply
      ON user.user_id = reply.user_id
      WHERE user.user_id IN (${userIdList})
      ORDER BY user.user_Id
      `;
      const userDetails = await db.all(userDetailsQuery);
      let nameList = [];

      userDetails.forEach((obj) => {
        nameList.push({ name: obj.name, reply: obj.reply });
      });

      if (tweetDetails.length !== 0) {
        response.send({
          replies: nameList,
        });
      } else {
        response.status(401);
        response.send("Invalid Request");
      }
    } catch (e) {
      console.log(e.message);
    }
  }
);

// POST "/user/tweets/" API

app.post("/user/tweets/", authentication, async (request, response) => {
  const { username } = request.payload;
  const { tweet } = request.body;
  try {
    const userIdQuery = `
        SELECT user_id
        FROM user
        WHERE username = '${username}'
        `;
    const userId = await db.get(userIdQuery);

    const dateString = new Date().toISOString();
    const dateTime = dateString.slice(0, 10) + " " + dateString.slice(11, 19);

    const createTweetQuery = `
    INSERT INTO tweet(tweet,user_id,date_time)
    VALUES(
        '${tweet}',
        ${userId.user_id},
        '${dateTime}')
    `;
    await db.run(createTweetQuery);
    response.send("Created a Tweet");
  } catch (e) {
    console.log(e.message);
  }
  //
});

// DELETE "/tweets/:tweetId/" API

app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { username } = request.payload;
  const { tweetId } = request.params;

  const getTweetQuery = `
    SELECT *
    FROM tweet
    WHERE user_id = (SELECT user_id
        FROM user
        WHERE username = '${username}')
    AND tweet_id = ${tweetId}
    `;
  const tweetDetails = await db.get(getTweetQuery);
  console.log(tweetDetails);
  if (tweetDetails === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const deleteQuery = `
        DELETE 
        FROM tweet
        WHERE tweet_id = ${tweetId}
        `;
    await db.run(deleteQuery);
    response.send("Tweet Removed");
  }
});

//

const initializeServerAndDatabase = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("server started at http://localhost:3000");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};

//

initializeServerAndDatabase();

module.exports = app;
