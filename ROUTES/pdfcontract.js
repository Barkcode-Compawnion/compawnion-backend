const express = require('express');
const cors = require('cors');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const pdfContract = express.Router();

pdfContract.use(cors());
pdfContract.use(express.json({ limit: '50mb' })); // To handle large image data (signature)

// Endpoint to save contract and signature to PDF
pdfContract.post('/save-signature', async (req, res) => {
  const { signatureData, adopterName, adoptionDate, animalName, adoptionFee } = req.body;

  // Validate signature data
  if (!signatureData || !signatureData.startsWith('data:image/png;base64,')) {
    return res.status(400).send({ message: 'Invalid or missing signature data' });
  }

  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Embed a standard font
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    // Add a page to the document
    const page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    const fontSize = 12;

    // Define contract text with placeholders
    const contractText = `
      Animal Adoption Agreement

      This agreement is made on ${adoptionDate} by and between ${adopterName} (the Adopter) 
      and the Rescue Organization (the Rescue) for the adoption of ${animalName}.

      Terms and Conditions:
      
      1. The Adopter agrees to provide adequate food, water, shelter, and exercise.
      2. The Adopter agrees to maintain the animal in a safe environment.
      3. The Adopter agrees to provide regular veterinary care.
      4. If the Adopter can no longer care for the animal, they agree to contact the Rescue.
      5. The adoption fee is $${adoptionFee}, supporting the Rescue's efforts.

      By signing below, both parties agree to the terms set forth in this adoption contract.

      Adopter: ${adopterName}
      Date: ${adoptionDate}
    `;

    // Add the contract text to the PDF
    page.drawText(contractText, { x: 50, y: height - 100, size: fontSize, font, lineHeight: 15 });

    // Add the signature image
    const signatureImageBytes = Buffer.from(signatureData.split(',')[1], 'base64');
    const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
    const signatureImageDims = signatureImage.scale(0.5);

    page.drawImage(signatureImage, {
      x: 50,
      y: height - 500,
      width: signatureImageDims.width,
      height: signatureImageDims.height,
    });

    // Serialize the PDF and save it
    const pdfBytes = await pdfDoc.save();
    const pdfPath = path.join(__dirname, 'adoption-contract.pdf');

    await fs.writeFile(pdfPath, pdfBytes);

    // Respond with the URL of the generated PDF (ensure static file serving is configured)
    res.json({ pdfUrl: `/adoption-contract.pdf` });
  } catch (error) {
    console.error('Error saving contract to PDF:', error);
    res.status(500).send({ message: 'Error saving contract to PDF', error: error.message });
  }
});

module.exports = pdfContract;
