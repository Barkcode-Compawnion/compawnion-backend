const express = require("express");
const pdfcontract = express.Router();
const PDFDocument = require("pdfkit");
const fs = require("fs"); // For saving PDF locally
const path = require("path");

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {express.Router}
 */
module.exports = function (db) {
  pdfcontract.post("/generate-contract/:id", async (req, res) => {
    const { id } = req.params;
    const { signature } = req.body; // Capture the base64 signature image

    if (!id) {
      return res.status(400).json({ message: "Application ID is required" });
    }

    try {
      const appDoc = await db
        .collection("Applications")
        .doc("PENDING")
        .collection("Applications")
        .doc(id)
        .get();

      if (!appDoc.exists) {
        return res.status(404).json({ message: "Application not found" });
      }

      const appData = appDoc.data();
      const { applicant, petData } = appData;

      if (!petData || !petData.id) {
        return res
          .status(404)
          .json({ message: "Pet data or Pet ID not found in application" });
      }

      const petId = petData.id;

      const rescuedAnimalDoc = await db
        .collection("RescuedAnimals")
        .doc(petId)
        .get();

      if (!rescuedAnimalDoc.exists) {
        return res
          .status(404)
          .json({ message: "Pet not found in RescuedAnimals" });
      }

      const rescuedAnimalData = rescuedAnimalDoc.data();
      const { personal, background } = rescuedAnimalData;

      if (!personal || !personal.name || !personal.breed) {
        return res
          .status(404)
          .json({ message: "Incomplete pet details in RescuedAnimals" });
      }

      const currentDate = new Date().toLocaleDateString();

      // Verify background data fields before using them
      const medicalHistory = background.medicalHistory || [];
      const vaccinationHistory = background.vaccination || [];

      const petDataText = `
        Pet Name: ${personal.name}
        Type: ${personal.type || "N/A"}
        Breed: ${personal.breed}
        Age: ${
          personal.age
            ? `${personal.age.year || 0} years ${
                personal.age.month || 0
              } months`
            : "N/A"
        }

        Rescue Details:
        - Rescue Date: ${background.rescueDate || "N/A"}
        - Size: ${background.size || "N/A"}
        - Weight: ${background.weight || "N/A"} kg
        - Rescue Story: ${background.rescueStory || "N/A"}
        
        Medical History:
        ${medicalHistory
          .map(
            (record) =>
              `- Procedure: ${record.procedure || "N/A"}, Date: ${
                record.date || "N/A"
              }, Notes: ${record.notes || "N/A"}`
          )
          .join("\n")}
        
        Vaccination History:
        ${vaccinationHistory
          .map(
            (vaccine) =>
              `- Vaccine: ${vaccine.name || "N/A"}, Date: ${
                vaccine.date || "N/A"
              }, Expiry: ${vaccine.expiry || "N/A"}`
          )
          .join("\n")}
      `;

      // Create a PDF document
      const pdfDoc = new PDFDocument();

      // Stream the PDF as a response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="adoption-contract.pdf"'
      );
      pdfDoc.pipe(res);

      // Add content to PDF
      pdfDoc
        .fontSize(16)
        .text("Compawnion AMS Adoption Contract", { align: "center" })
        .moveDown();

      pdfDoc
        .fontSize(12)
        .text(
          `By signing this agreement, the Adopter agrees to the following terms and conditions regarding the adoption of an animal from the Adoption Agency.\n\n` +
            `We are placing the following described animal with you for adoption:\n\n` +
            `Animal Information:\n${petDataText}\n\n` +
            `TERM CONDITIONS AND AGREEMENT\n\n` +
            `I agree that the animal will not be sold, nor given away, or transferred to another individual or organization without prior written consent from the Adoption Agency. The Adopter will not use the animal for breeding purposes.\n\n` +
            `I agree if at any point I can no longer care for the animal, I agree to return the animal to the Adoption Agency. Under no circumstances will the animal be abandoned, surrendered to a shelter, or placed in a new home without notifying the Adoption Agency.\n\n` +
            `I acknowledge that adopting an animal involves inherent risks, including but not limited to injury, illness, or behavioral issues. The Adoption Agency cannot be held liable for any injury, damage, or loss caused by the adopted animal after the adoption has been finalized. I agree to assume full responsibility for the care and behavior of the adopted animal.\n\n` +
            `I must reside in a suitable location that allows for the proper care of the animal, must demonstrate the ability to provide a safe, loving, and appropriate environment for the adopted animal.\n\n` +
            `The adopter must be 18 years old and above, if not, should be accompanied by a guardian/older family member.\n\n` +
            `I agree to maintain proper identification (such as a collar and RFID tag) for the animal at all times.\n\n` +
            `In case the adopter damages the RFID tag, there will be a penalty of 1,500 for replacement.\n\n` +
            `The Adopter agrees to make a non-refundable adoption fee of 500 pesos. Your fee includes spay/neuter, RFID tag, and vaccines current to the age of the dog/puppy/cat/kitten. Any vaccines or medical care costs after the adoption are the financial responsibility of the Adopter.\n\n` +
            `The Adopter acknowledges that they have read, understood, and agreed to the terms and conditions of the animal adoption process as outlined above.\n\n`,
          { align: "left" }
        );

      pdfDoc
        .text(`Adopter’s Information:\n`, { underline: true })
        .text(`• Full Name: ${applicant.name}\n`)
        .text(`• Phone Number: ${applicant.phone}\n`)
        .text(`• Email Address: ${applicant.email}\n\n`)
        .text(
          `Adopter’s Signature:\n\n\n\n• Signature: ___________________________\n• Date: ${currentDate}`
        );

      // Check if signature exists and is a valid base64 string
      if (signature && signature.startsWith("data:image")) {
        // Embed the signature as an image in the PDF
        const imgData = signature.split(";base64,")[1]; // Extract the base64 data
        const imgBuffer = Buffer.from(imgData, "base64");

        // Insert the signature image into the PDF, adjusting its size and position
        pdfDoc
          .image(imgBuffer, pdfDoc.x + 70, pdfDoc.y - 75, {
            width: 200,
            height: 80,
          }) // Adjust the position and size
          .moveDown();
      }

      // Finalize the PDF
      pdfDoc.end();
    } catch (error) {
      console.error("Error generating contract:", error.message);
      console.error("Stack Trace:", error.stack); // Logs the error stack trace
      res
        .status(500)
        .json({ message: "Failed to generate contract", error: error.message });
    }
  });

  return pdfcontract;
};
