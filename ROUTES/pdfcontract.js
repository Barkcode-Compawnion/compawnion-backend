const express = require("express");
const { PDFDocument, rgb } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const pdfContract = express.Router();

/**
 * Generates a PDF for the given application data.
 * @param {Object} applicationData - The application data to include in the PDF.
 * @returns {Promise<Buffer>} - The generated PDF as a byte buffer.
 */
async function generatePDF(applicationData) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);

  const { applicant, applicationAppId, applicationType } = applicationData;

  // Prepare text content for the PDF
  const title = `Application ID: ${applicationAppId}`;
  const name = `Name: ${applicant.firstName} ${applicant.middleName} ${applicant.lastName}`;
  const type = `Application Type: ${applicationType}`;
  const email = `Email: ${applicant.contactInfo.emailAddress}`;

  // Draw text on the PDF
  page.drawText(title, { x: 50, y: 750, size: 20, color: rgb(0, 0, 0) });
  page.drawText(name, { x: 50, y: 700, size: 15 });
  page.drawText(type, { x: 50, y: 670, size: 15 });
  page.drawText(email, { x: 50, y: 640, size: 15 });

  // Serialize the PDF to bytes
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Generates and saves a PDF locally.
 * @param {Object} applicationData - The application data to include in the PDF.
 * @returns {Promise<string>} - The file path of the saved PDF.
 */
async function generateAndSavePDF(applicationData) {
  const pdfBytes = await generatePDF(applicationData);

  const pdfPath = path.join(__dirname, `application_${applicationData.applicationAppId}.pdf`);
  fs.writeFileSync(pdfPath, pdfBytes); // Save the PDF locally
  return pdfPath;
}

// Route to generate a PDF (for testing purposes)
pdfContract.post("/generate", async (req, res) => {
  const applicationData = req.body; // Expecting application data in the request body

  try {
    const pdfPath = await generateAndSavePDF(applicationData); // Generate and save the PDF
    console.log(`PDF generated at: ${pdfPath}`);
    res.status(201).send({ message: "PDF generated", pdfPath });
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send({ message: "Error generating PDF", error: error.message });
  }
});

module.exports = pdfContract;
