import path from "path";
import { processDocuments } from "./services/pdfProcessor.js";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
    const pdfPath = path.join(__dirname, "uploads", "1780174019385-Viva_QnA_All_Units.pdf");
    
    if (fs.existsSync(pdfPath)) {
        console.log(`Testing with file: ${pdfPath}`);
        try {
            const chunks = await processDocuments([pdfPath]);
            console.log(`\n✅ Successfully processed! Got ${chunks.length} chunks.`);
            if (chunks.length > 0) {
                console.log("\nSample chunk 0:");
                console.log(chunks[0].pageContent.substring(0, 300) + "...");
                console.log("Metadata:", chunks[0].metadata);
            }
        } catch (error) {
            console.error("Error processing document:", error);
        }
    } else {
        console.log(`File not found: ${pdfPath}`);
    }
}

test();
