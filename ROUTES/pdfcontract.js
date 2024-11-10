const express = require("express");
const { PDFDocument, rgb } = require("pdf-lib");
const { createWriteStream } = require("fs");

module.exports = function (db) {
  const pdfContract = express.Router();

  /**
   * Generate PDF contract for adoption agreement
   * @param {Object} data - Adoption data containing petId and applicationId
   * @returns {Promise<string>} - Promise resolving to the PDF file name
   */
  async function generatePdfContract(data) {
    try {
      const { petId, applicationId } = data;

      // Fetch pet details from Firestore using petId
      const petRef = db.collection("RescuedAnimals").doc(petId);
      const petDoc = await petRef.get();
      if (!petDoc.exists) {
        throw new Error("Pet not found.");
      }
      const petData = petDoc.data();
      const { name, breed, gender, rfid } = petData;

      // Fetch application details from Firestore using applicationId
      const appRef = db.collection("Applications").doc("PENDING").collection("Applications").doc(applicationId);
      const appDoc = await appRef.get();
      if (!appDoc.exists) {
        throw new Error("Application not found.");
      }
      const appData = appDoc.data();
      const { fullName, phoneNumber, email } = appData.applicant;

      // Create a new PDF document using pdf-lib
      const doc = await PDFDocument.create();

      // Add a page to the PDF
      const page = doc.addPage([600, 800]);
      const { width, height } = page.getSize();

      // Embed the built-in font (Helvetica)
      const font = await doc.embedStandardFont(PDFDocument.StandardFonts.Helvetica);

      // Add title and introduction
      page.drawText("Adoption Agreement", {
        x: width / 2 - 100,
        y: height - 100,
        size: 20,
        font,
        color: rgb(0, 0, 0),
        align: 'center',
      });
      page.drawText("By signing this agreement, the Adopter agrees to the following terms and conditions regarding the adoption of an animal from the Adoption Agency", {
        x: 50,
        y: height - 150,
        size: 12,
        font,
        color: rgb(0, 0, 0),
        maxWidth: 500
      });

      // Animal details section
      page.drawText("We are placing the following described animal with you for adoption:", {
        x: 50,
        y: height - 200,
        size: 14,
        font,
        color: rgb(0, 0, 0)
      });
      page.drawText(`Animal Name: ${name}`, { x: 50, y: height - 230, size: 12, font, color: rgb(0, 0, 0) });
      page.drawText(`Gender: ${gender}`, { x: 50, y: height - 250, size: 12, font, color: rgb(0, 0, 0) });
      page.drawText(`Breed: ${breed}`, { x: 50, y: height - 270, size: 12, font, color: rgb(0, 0, 0) });
      page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 50, y: height - 290, size: 12, font, color: rgb(0, 0, 0) });
      page.drawText(`RFID Tag: ${rfid}`, { x: 50, y: height - 310, size: 12, font, color: rgb(0, 0, 0) });

      // Terms and conditions
      page.drawText("TERM CONDITIONS AND AGREEMENT", { x: 50, y: height - 350, size: 14, font, color: rgb(0, 0, 0) });
      page.drawText(`I agree that the animal will not be sold, nor given away, or transferred to another individual or organization without prior written consent from the Adoption Agency.`, {
        x: 50,
        y: height - 370,
        size: 12,
        font,
        color: rgb(0, 0, 0),
        maxWidth: 500,
      });
      page.drawText(`I agree if at any point I can no longer care for the animal, I agree to return the animal to the Adoption Agency. Under no circumstances will the animal be abandoned.`, {
        x: 50,
        y: height - 400,
        size: 12,
        font,
        color: rgb(0, 0, 0),
        maxWidth: 500,
      });

      // Adopter information section
      page.drawText("Adopter’s Information:", { x: 50, y: height - 450, size: 14, font, color: rgb(0, 0, 0) });
      page.drawText(`Full Name: ${fullName}`, { x: 50, y: height - 470, size: 12, font, color: rgb(0, 0, 0) });
      page.drawText(`Phone Number: ${phoneNumber}`, { x: 50, y: height - 490, size: 12, font, color: rgb(0, 0, 0) });
      page.drawText(`Email Address: ${email}`, { x: 50, y: height - 510, size: 12, font, color: rgb(0, 0, 0) });

      // Signature and date
      page.drawText("Adopter’s Signature:", { x: 50, y: height - 550, size: 14, font, color: rgb(0, 0, 0) });
      page.drawText("By signing below, the Adopter agrees to the terms and conditions of this Adoption Agreement.", {
        x: 50,
        y: height - 570,
        size: 12,
        font,
        color: rgb(0, 0, 0),
        maxWidth: 500,
      });
      page.drawText("Signature: ___________________________", { x: 50, y: height - 590, size: 12, font, color: rgb(0, 0, 0) });
      page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 50, y: height - 610, size: 12, font, color: rgb(0, 0, 0) });

      // Serialize the document to bytes
      const pdfBytes = await doc.save();

      // Write the PDF to a file
      const fileName = `AdoptionAgreement-${applicationId}.pdf`;
      await createWriteStream(`./${fileName}`).write(pdfBytes);

      return fileName;
    } catch (error) {
      console.error("Error generating PDF contract:", error);
      throw error;
    }
  }

  // POST route to generate PDF contract
  pdfContract.post("/", async (req, res) => {
    const { petId, applicationId } = req.body;  // Data from the POST request
    if (!petId || !applicationId) {
      return res.status(400).send({ message: "petId and applicationId are required." });
    }

    try {
      const pdfFileName = await generatePdfContract({ petId, applicationId });
      res.download(`./${pdfFileName}`, (err) => {
        if (err) {
          console.error("Error sending file:", err);
          res.status(500).send({ message: "Error sending PDF contract." });
        }
      });
    } catch (error) {
      console.error("Error in PDF contract generation:", error);
      res.status(500).send({ message: "Error generating PDF contract", error: error.message });
    }
  });

  return pdfContract;
};
