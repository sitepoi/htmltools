const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const base =
  "https://firebasestorage.googleapis.com/v0/b/societyapp-edd4c.appspot.com/o/CENTRECANADA%2FFOLDERS%2F2026-11-16-6Q39QA2TNF%2FNHSP-2025%2F";

const files = [
  ["space-05", base + "Space-Center-Trip-Aug-06%2F5.jpeg?alt=media&token=da471597-8aa8-422e-898b-710ed23dc668"],
  ["ai-1", base + "AI-Seminar%2F1.jpeg?alt=media&token=09742ac5-0141-44d6-80eb-5ceb74b66639"],
  ["ai-2", base + "AI-Seminar%2F2.jpeg?alt=media&token=e352e630-b4f3-4ce6-bc4e-bc561008aa95"],
  ["ai-3", base + "AI-Seminar%2F3.jpeg?alt=media&token=e9f489a8-211f-4aa3-9242-14d8b4195738"],
  ["ai-4", base + "AI-Seminar%2F4.jpeg?alt=media&token=ddf8c388-4683-4e57-9cb7-8bbdaf6158d7"],
  ["ai-5", base + "AI-Seminar%2F5.jpeg?alt=media&token=320733ad-9f5b-40db-aa85-51b6fb11853d"],
  ["eng-1", base + "English-Classes%2F1.jpeg?alt=media&token=0d5ca42f-c786-44d1-87b0-85d94b8761fa"],
  ["eng-2", base + "English-Classes%2F2.jpeg?alt=media&token=12aae9ed-2a5b-460c-a2ee-28ffb99f891c"],
  ["eng-3", base + "English-Classes%2F3.jpeg?alt=media&token=088afdd1-0248-4c4d-b035-3cd9cb3d1450"],
  ["eng-4", base + "English-Classes%2F4.jpeg?alt=media&token=3b0ece8d-9d19-45a3-b470-89f4a693dfc6"],
  ["space-1", base + "Space-Center-Trip-Aug-06%2F1.jpeg?alt=media&token=906275a9-420b-4280-8f80-2a9f2dba02a9"],
  ["space-2", base + "Space-Center-Trip-Aug-06%2F2.jpeg?alt=media&token=968e43cb-c02c-4fc2-8791-5b92da7d3259"],
  ["space-3", base + "Space-Center-Trip-Aug-06%2F3.jpeg?alt=media&token=86634769-71ee-4780-8eec-d722e4a7d45e"],
  ["space-6", base + "Space-Center-Trip-Aug-06%2F6.jpeg?alt=media&token=24bcf33b-fe58-4ddc-b160-e7be73cb1978"],
  ["space-9", base + "Space-Center-Trip-Aug-06%2F9.jpeg?alt=media&token=cb6c018b-8419-4f90-a3c7-324b857d874a"],
  ["space-10", base + "Space-Center-Trip-Aug-06%2F10.jpeg?alt=media&token=f6ab5011-6180-4c75-a76d-e36a3a9232f9"],
  ["space-11", base + "Space-Center-Trip-Aug-06%2F11.jpeg?alt=media&token=596d8444-cebf-4abf-bba3-9e7944060189"],
  ["space-12", base + "Space-Center-Trip-Aug-06%2F12.jpeg?alt=media&token=11310378-a062-42d1-9742-26012753d83f"],
  ["space-13", base + "Space-Center-Trip-Aug-06%2F13.jpeg?alt=media&token=eceb8e4b-8adb-4d7f-8730-4d3a8221c3a0"],
  ["space-14", base + "Space-Center-Trip-Aug-06%2F14.jpeg?alt=media&token=32f8006a-bf06-49e4-8204-1606edc4bb6c"],
  ["space-15", base + "Space-Center-Trip-Aug-06%2F15.jpeg?alt=media&token=7a66ed1f-ea46-478f-a563-54d42c6bc575"],
  ["space-16", base + "Space-Center-Trip-Aug-06%2F16.jpeg?alt=media&token=b5c8556d-b365-4603-8905-db38723ceb55"],
  ["space-17", base + "Space-Center-Trip-Aug-06%2F17.jpeg?alt=media&token=aaf87b16-a843-47b8-a19d-5b5e9dcdf10a"],
  ["space-18", base + "Space-Center-Trip-Aug-06%2F18.jpeg?alt=media&token=fcd498a6-0838-4eea-8ed7-334a3b757092"],
  ["space-19", base + "Space-Center-Trip-Aug-06%2F19.jpeg?alt=media&token=b3091ff8-b334-4d4e-ae60-2de3db6a2385"],
  ["space-20", base + "Space-Center-Trip-Aug-06%2F20.jpeg?alt=media&token=a19a71c7-4c50-4fb6-8757-77721c6b6a24"],
  ["space-21", base + "Space-Center-Trip-Aug-06%2F21.jpeg?alt=media&token=225cc186-aab1-4ac1-8610-628a0a28a0f3"],
  ["tursu-1", base + "Tursu-workshop%2F1.jpeg?alt=media&token=3b99b6d3-9ff8-4206-9048-9790796607be"],
  ["tursu-2", base + "Tursu-workshop%2F2.jpeg?alt=media&token=a99ebb98-7303-4cde-b372-2206e2a019aa"],
  ["tursu-3", base + "Tursu-workshop%2F3.jpeg?alt=media&token=8aac50ca-30f5-44fd-9b0c-433a2e12c732"],
  ["tursu-4", base + "Tursu-workshop%2F4.jpeg?alt=media&token=a7e2c783-527a-48de-be3d-caa464cff239"],
  ["tursu-5", base + "Tursu-workshop%2F5.jpeg?alt=media&token=d2a8de9e-18ff-4be2-b265-3e50bca97f85"],
  ["tursu-6", base + "Tursu-workshop%2F6.jpeg?alt=media&token=c64e1a17-f69f-4739-9b2d-8d1dd951ad9f"],
  ["tursu-7", base + "Tursu-workshop%2F7.jpeg?alt=media&token=12402147-f33a-4507-bd7c-5b346229950a"]
];

const imagesDir = path.join(
  __dirname,
  "..",
  "OTHERS-HELPERS",
  "PRESENTATIONS",
  "NHSP",
  "images"
);

function sha(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

(async () => {
  const remoteHashes = new Map();
  for (const [name, url] of files) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.log("REMOTE " + name + " HTTP " + response.status);
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      remoteHashes.set(sha(buffer), name + " (" + buffer.length + ")");
    } catch (error) {
      console.log("REMOTE " + name + " ERR " + error.message);
    }
  }

  const localFiles = fs.readdirSync(imagesDir).filter((file) => /\.(webp|jpg|jpeg|png)$/i.test(file));
  for (const file of localFiles) {
    const buffer = fs.readFileSync(path.join(imagesDir, file));
    const match = remoteHashes.get(sha(buffer));
    console.log(file.padEnd(24) + " -> " + (match || "NO EXACT MATCH"));
  }
})();
