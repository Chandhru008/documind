import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import path from "path";

/**
 * Processes uploaded PDF files: extracts text and splits into chunks.
 * Each chunk retains metadata about its source document and page number.
 */
export async function processDocuments(filePaths) {
  const allChunks = [];

  for (const filePath of filePaths) {
    const fileName = path.basename(filePath);
    console.log(`📄 Processing: ${fileName}`);

    // Load PDF and extract text page-by-page
    const loader = new PDFLoader(filePath, {
      splitPages: true,
    });
    const docs = await loader.load();

    // Enrich metadata with the original filename
    docs.forEach((doc) => {
      doc.metadata.source = fileName;
      doc.metadata.documentName = fileName;
    });

    console.log(`   → Extracted ${docs.length} pages from ${fileName}`);

    // Split into smaller chunks for better retrieval accuracy
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ". ", " ", ""],
    });

    const chunks = await splitter.splitDocuments(docs);

    // Preserve document-level metadata on each chunk
    chunks.forEach((chunk, index) => {
      chunk.metadata.chunkIndex = index;
      chunk.metadata.documentName = fileName;
    });

    console.log(`   → Split into ${chunks.length} chunks`);
    allChunks.push(...chunks);
  }

  console.log(`✅ Total chunks across all documents: ${allChunks.length}`);
  return allChunks;
}
