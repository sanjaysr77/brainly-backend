import dotenv from "dotenv";
dotenv.config()
//import { JWT_PASSWORD } from "config";
import mongoose, {model, Schema} from "mongoose";
const ObjectId = mongoose.Types.ObjectId;

async function main() {
    try {
        const MONGO_URL = process.env.MONGO_URL;
        if (!MONGO_URL) {
            throw new Error("MONGO_URL is missing from .env file");
        }
        await mongoose.connect(MONGO_URL);
        console.log("MongoDB Connected Successfully!");
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        process.exit(1);
    }
}
main();

const UserSchema = new Schema({
    username: {type: String, unique: true},
    password: String
})

export const UserModel = model("User", UserSchema);

const ContentSchema = new Schema({
    title: String,
    link: String,
    tags: [{type: ObjectId, ref: 'Tag'}],
    type: String,
    userId: {type: ObjectId, ref: 'User', required: true },
})

const LinkSchema = new Schema({
    hash: String,
    userId: {type: ObjectId, ref: 'User', required: true, unique: true },
})

export const LinkModel = model("Links", LinkSchema);
export const ContentModel = model("Content", ContentSchema);

const TagSchema = new Schema ({
    name: String
})

export const TagModel = model("Tag", TagSchema);