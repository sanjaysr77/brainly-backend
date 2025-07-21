import express from "express";
import { random } from "./utils";
import jwt from "jsonwebtoken";
import { ContentModel, LinkModel, TagModel, UserModel } from "./db";
import { JWT_PASSWORD } from "./config";
import { userMiddleware } from "./middleware";
import cors from "cors";
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/community/vectorstores/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import 'dotenv/config';
import { Document } from "langchain/document";

const app = express();
app.use(express.json());
app.use(cors())

const pinecone = new Pinecone();
const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
const embeddings = new OpenAIEmbeddings();

app.post("/api/v1/signup", async (req, res) => {
    // TODO: zod validation , hash the password
    const username = req.body.username;
    const password = req.body.password;

    try {
        await UserModel.create({
            username: username,
            password: password
        })

        res.json({
            message: "User signed up"
        })
        console.log("Signed Up")
    } catch (e) {
        res.status(411).json({
            message: "User already exists"
        })
    }
})

app.post("/api/v1/signin", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    const existingUser = await UserModel.findOne({
        username,
        password
    })
    if (existingUser) {
        const token = jwt.sign({
            id: existingUser._id
        }, JWT_PASSWORD)

        res.json({
            token
        })
    } else {
        res.status(403).json({
            message: "Incorrrect credentials"
        })
    }
})

app.post("/api/v1/content", userMiddleware, async (req, res) => {
  try {
    const { link, type, title, tags = [] } = req.body;

    const tagIds = [];
    const tagNames = [];

    for (const tagName of tags) {
      let tag = await TagModel.findOne({ name: tagName });

      if (!tag) {
        tag = await TagModel.create({ name: tagName });
      }

      tagIds.push(tag._id);
      tagNames.push(tag.name);
    }

    const content = await ContentModel.create({
      link,
      type,
      title,
      userId: req.userId,
      tags: tagIds,
      tagname: tagNames,
    });

    const combinedText = `${title}\n${type}\n${tagNames.join(", ")}\n${link}`;

    // Create LangChain document with metadata
    const doc = new Document({
      pageContent: combinedText,
      metadata: {
        contentId: content._id.toString(),
        userId: req.userId,
        title,
        type,
        link,
        tags: tagNames,
      },
    });

    // Connect to existing Pinecone index
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: `user-${req.userId}`,
    });

    // Add document with custom vector ID
    await vectorStore.addDocuments([doc], {
      ids: [content._id.toString()],
    });

    res.json({
      message: "Content added",
      content,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/api/v1/content", userMiddleware, async (req, res) => {
    // @ts-ignore
    const userId = req.userId;
    const content = await ContentModel.find({
        userId: userId
    }).populate("userId", "username password _id") //Replaces the userId (which is just an ObjectId) in each content document with the actual user document — but only with the selected fields: username, password, and _id.
    res.json({
        content
    })
})

app.post("/api/v1/query", userMiddleware, async (req, res) => {
  try {
    const { query } = req.body;

    // 1. Create embedding from query
    const embeddings = new OpenAIEmbeddings();
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: `user-${req.userId}`,
    });

    // 2. Perform similarity search WITH SCORE
    const resultsWithScores = await vectorStore.similaritySearchWithScore(query, 3); // top 5 with scores

    // 3. Sort by score DESC (higher = more relevant)
    const sortedResults = resultsWithScores.sort((a, b) => b[1] - a[1]);

    // 4. Extract ordered content IDs
    const contentIds = sortedResults.map(([doc]) => doc.metadata.contentId);

    // 5. Fetch all matching content from MongoDB
    const contents = await ContentModel.find({ _id: { $in: contentIds } });

    // 6. Create a lookup map for ordering
    const contentMap = new Map(contents.map((doc) => [doc._id.toString(), doc]));

    // 7. Reorder contents based on score ranking
    const orderedContents = contentIds.map((id) => contentMap.get(id));

    res.json({ results: orderedContents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not process query" });
  }
});

app.delete("/api/v1/content", userMiddleware, async (req, res) => {
    try {
        const contentId = req.body.contentId;
        const userId = req.userId;

        if (!contentId) {
            res.status(400).json({ message: "contentId is required" });
            return; // ✅ return to stop further execution
        }

        const result = await ContentModel.deleteOne({ _id: contentId, userId });

        if (result.deletedCount === 0) {
            res.status(404).json({ message: "Content not found or not authorized" });
            return; // ✅ return to stop further execution
        }

        res.json({ message: "Deleted successfully" });
    } catch (error) {
        console.error("Delete error:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Server error" });
        }
    }
});

app.post("/api/v1/brain/share", userMiddleware, async (req, res) => {
    const share = req.body.share;
    if (share) {
        const existingLink = await LinkModel.findOne({
            userId: req.userId
        });

        if (existingLink) {
            res.json({
                hash: existingLink.hash
            })
            return;
        }
        const hash = random(10);
        await LinkModel.create({
            userId: req.userId,
            hash: hash
        })

        res.json({
            hash
        })
    } else {
        await LinkModel.deleteOne({
            userId: req.userId
        });

        res.json({
            message: "Removed link"
        })
    }
})

app.get("/api/v1/brain/:shareLink", async (req, res) => {
    const hash = req.params.shareLink;

    const link = await LinkModel.findOne({
        hash
    });

    if (!link) {
        res.status(411).json({
            message: "Sorry incorrect input"
        })
        return;
    }
    // userId
    const content = await ContentModel.find({
        userId: link.userId
    })

    console.log(link);
    const user = await UserModel.findOne({
        _id: link.userId
    })

    if (!user) {
        res.status(411).json({
            message: "user not found, error should ideally not happen"
        })
        return;
    }

    res.json({
        username: user.username,
        content: content
    })

})

app.listen(3000, () => {
    console.log("Running on Port 3000")
})