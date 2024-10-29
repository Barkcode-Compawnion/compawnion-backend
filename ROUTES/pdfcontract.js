const express = require("express");
const { PDFDocument, rgb } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const pdfContract = express.Router();

/**
 * Generates a PDF for the adoption contract.
 * @param {Object} applicationData - The application data to include in the PDF.
 * @param {string} signatureData - The base64 signature image data.
 * @returns {Promise<Buffer>} - The generated PDF as a byte buffer.
 */
async function generatePDF(applicationData, signatureData) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);

    // Define content for the contract
    const title = 'Adoption Contract';
    const adopterName = `${applicationData.applicant.firstName} ${applicationData.applicant.middleName} ${applicationData.applicant.lastName}`;
    const petDetails = `
Pet Name: ${applicationData.petName}
Breed: ${applicationData.breed}
Age: ${applicationData.age}`;
    
    const terms = `
Terms and Conditions:
1. The adopter agrees to provide a loving home.
2. The adopter agrees to return the pet to the agency if they can no longer care for it.
3. The adopter is responsible for all vet care and food costs.`;
    
    const signatureLine = `
Signature: ________________________________________
Date: ___________________`;

    // Draw text on the PDF
    page.drawText(title, { x: 50, y: 750, size: 24, color: rgb(0, 0, 0) });
    page.drawText(`Adopter Name: ${adopterName}`, { x: 50, y: 700, size: 16 });
    page.drawText(`Pet Details:${petDetails}`, { x: 50, y: 650, size: 15 });
    page.drawText(terms, { x: 50, y: 500, size: 15 });
    page.drawText(signatureLine, { x: 50, y: 300, size: 15 });

    // Draw the signature image if provided
    if (signatureData) {
        const pngImage = await pdfDoc.embedPng(signatureData);
        const pngDims = pngImage.scale(0.5); // Scale down the image if necessary
        page.drawImage(pngImage, {
            x: 50,
            y: 240, // Adjust Y position as needed for signature
            width: pngDims.width,
            height: pngDims.height,
        });
    }

    // Serialize the PDF to bytes
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

/**
 * Generates and saves a PDF locally.
 * @param {Object} applicationData - The application data to include in the PDF.
 * @param {string} signatureData - The base64 signature image data.
 * @returns {Promise<string>} - The file path of the saved PDF.
 */
async function generateAndSavePDF(applicationData, signatureData) {
    const pdfBytes = await generatePDF(applicationData, signatureData);

    const pdfPath = path.join(__dirname, `adoption_contract_${applicationData.applicationAppId}.pdf`);
    fs.writeFileSync(pdfPath, pdfBytes); // Save the PDF locally
    return pdfPath;
}

// Route to generate a PDF
pdfContract.post("/generate", async (req, res) => {
    const applicationData = req.body.applicationData; // Expecting application data in the request body
    const signatureData = req.body.signature; // Expecting the signature image data

    try {
        const pdfPath = await generateAndSavePDF(applicationData, signatureData); // Generate and save the PDF
        console.log(`PDF generated at: ${pdfPath}`);
        res.status(201).send({ message: "PDF generated", pdfPath });
    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).send({ message: "Error generating PDF", error: error.message });
    }
});

module.exports = pdfContract;
