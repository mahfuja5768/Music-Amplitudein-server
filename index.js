const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mz3fw7v.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  // console.log("inside verifyToken", req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};


async function run() {
  try {
    await client.connect();

    const allShows = client.db("musicShows").collection("bandShows");
    const cartTickets = client.db("musicShows").collection("myCart");
    const usersCollection = client.db("musicShows").collection("users");

    //jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.send({ token });
    });

    
//use verify admin after verifyToken
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await usersCollection.findOne(query);
  const isAdmin = user?.role === "admin";
  if (!isAdmin) {
    return res.status(403).send({ message: "Forbidden access" });
  }

  next();
};

    //post users
    app.post("/users", verifyToken, async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (!existingUser) {
        const result = await usersCollection.insertOne(user);
        res.send(result);
      } else {
        return res.send({ message: "user already exists", insertedId: null });
      }
    });

    //get users

    app.get("/users", verifyToken,verifyAdmin, async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        // console.log(error);
      }
    });

    //get role
    app.get("/user-role/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        // console.log(query)
        const result = await usersCollection.find(query).toArray();
        // console.log(result)
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

     //make admin
     app.patch(
      "/users/make-admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    
    //delete users
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    //get band shows
    app.get("/shows", async (req, res) => {
      try {
        // if i do not  want any data
        const projection = {
          bandName: 1,
          date: 1,
          img: 1,
          time: 1,
          stage: 1,
        };
        const result = await allShows.find().project(projection).toArray();
        // const result = await allShows.find().toArray();
        res.send(result);
      } catch (error) {
        // console.log(error);
      }
    });
    app.get("/shows/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await allShows.find(query).toArray();
        res.send(result);
      } catch (error) {
        // console.log(error);
      }
    });
    app.put("/shows/:id", verifyToken,verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const body = req.body;
        // console.log(body)
        const updatedShow = {
          $set: { ...body },
        };
        const option = { upsert: true };
        const result = await allShows.updateOne(query, updatedShow, option);
        res.send(result);
      } catch (error) {
        // console.log(error);
        res.send(error);
      }
    });
    app.delete("/shows/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await allShows.deleteOne(query);
        res.send(result);
      } catch (error) {
        // console.log(error);
        res.send(error);
      }
    });
    //post new show
    app.post("/shows",verifyToken,verifyAdmin, async (req, res) => {
      try {
        const newShow = req.body;
        const result = await allShows.insertOne(newShow);
        res.send(result);
      } catch (error) {
        // console.log(error);
      }
    });
    //add to cart
    app.post("/cartTickets",verifyToken, async (req, res) => {
      try {
        const ticket = req.body;
        const result = await cartTickets.insertOne(ticket);
        res.send(result);
      } catch (error) {
        // console.log(error);
      }
    });

    app.get("/myCartTickets", verifyToken, async (req, res) => {
      console.log("hi---->", req.decoded);
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await cartTickets.find(query).toArray();
      res.send(result);
    });

    app.delete("/cartTickets/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await cartTickets.deleteOne(query);
        res.send(result);
      } catch (error) {
        // console.log(error);
        res.send(error);
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (Req, res) => {
  res.send("Server is running ......");
});

app.listen(port, () => {
  console.log(`Music amp. server is running on ${port} `);
});
