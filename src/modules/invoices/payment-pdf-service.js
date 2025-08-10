/**
 * CreatorsMantra Backend - Payment Tracking & PDF Generation Services
 * Complete payment management and document generation
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Payment tracking, reminders, PDF generation with branded templates
 */

const { PaymentTracking, PaymentReminder, Invoice, InvoiceTemplate } = require('./model');
const { 
  generateRandomString,
  formatCurrency,
  sendEmail,
  uploadToS3,
  logInfo,
  logError
} = require('../../shared/utils');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ============================================
// PAYMENT TRACKING SERVICE
// ============================================

class PaymentTrackingService {

  /**
   * Record Payment for Invoice
   * @param {String} invoiceId - Invoice ID
   * @param {Object} paymentData - Payment details
   * @param {String} creatorId - Creator ID
   * @returns {Object} Payment tracking record
   */
  async recordPayment(invoiceId, paymentData, creatorId) {
    try {
      logInfo('Recording payment', { invoiceId, amount: paymentData.amount });

      // Get invoice
      const invoice = await Invoice.findOne({ _id: invoiceId, creatorId });
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Validate payment amount
      const invoiceAmount = invoice.taxSettings.taxCalculation.finalAmount;
      const existingPayments = await this.getInvoicePayments(invoiceId);
      const totalPaid = existingPayments.reduce((sum, payment) => sum + payment.amountDetails.paidAmount, 0);
      const remainingAmount = invoiceAmount - totalPaid;

      if (paymentData.amount > remainingAmount) {
        throw new Error(`Payment amount (${paymentData.amount}) exceeds remaining balance (${remainingAmount})`);
      }

      // Generate payment ID
      const paymentId = `PAY${Date.now()}${generateRandomString(4, 'NUMBERS')}`;

      // Determine payment type
      let paymentType = 'partial';
      if (totalPaid === 0 && paymentData.amount >= invoiceAmount * 0.5) {
        paymentType = 'advance';
      } else if (paymentData.amount >= remainingAmount) {
        paymentType = 'final';
      }

      // Create payment tracking record
      const paymentTracking = new PaymentTracking({
        invoiceId,
        paymentId,
        amountDetails: {
          paidAmount: paymentData.amount,
          remainingAmount: remainingAmount - paymentData.amount,
          totalInvoiceAmount: invoiceAmount,
          paymentType,
          milestoneInfo: paymentData.milestoneInfo || {}
        },
        paymentMethod: paymentData.paymentMethod,
        paymentDate: new Date(paymentData.paymentDate),
        receivedDate: new Date(),
        transactionDetails: {
          transactionId: paymentData.transactionId,
          referenceNumber: paymentData.referenceNumber,
          payerName: paymentData.payerName,
          payerAccount: paymentData.payerAccount,
          bankReference: paymentData.bankReference
        },
        verification: {
          isVerified: paymentData.isVerified || false,
          verificationNotes: paymentData.verificationNotes
        },
        status: 'pending',
        notes: paymentData.notes
      });

      await paymentTracking.save();

      // Update invoice status
      await this.updateInvoicePaymentStatus(invoiceId, totalPaid + paymentData.amount, invoiceAmount);

      // Generate receipt if verified
      if (paymentData.isVerified) {
        await this.generatePaymentReceipt(paymentTracking._id);
      }

      logInfo('Payment recorded successfully', { 
        paymentId, 
        invoiceId, 
        amount: paymentData.amount,
        newStatus: paymentTracking.status
      });

      return paymentTracking;

    } catch (error) {
      logError('Error recording payment', { error: error.message, invoiceId });
      throw error;
    }
  }

  /**
   * Get Invoice Payments
   * @param {String} invoiceId - Invoice ID
   * @returns {Array} Payment records
   */
  async getInvoicePayments(invoiceId) {
    try {
      return await PaymentTracking.find({ invoiceId }).sort({ paymentDate: -1 });
    } catch (error) {
      logError('Error fetching invoice payments', { error: error.message, invoiceId });
      throw error;
    }
  }

  /**
   * Update Invoice Payment Status
   * @param {String} invoiceId - Invoice ID
   * @param {Number} totalPaid - Total amount paid
   * @param {Number} invoiceAmount - Total invoice amount
   */
  async updateInvoicePaymentStatus(invoiceId, totalPaid, invoiceAmount) {
    try {
      let status = 'sent';

      if (totalPaid >= invoiceAmount) {
        status = 'paid';
      } else if (totalPaid > 0) {
        status = 'partially_paid';
      }

      // Check if overdue
      const invoice = await Invoice.findById(invoiceId);
      if (invoice && new Date() > invoice.invoiceSettings.dueDate && status !== 'paid') {
        status = 'overdue';
      }

      await Invoice.findByIdAndUpdate(invoiceId, { status });

      logInfo('Invoice payment status updated', { invoiceId, status, totalPaid, invoiceAmount });

    } catch (error) {
      logError('Error updating invoice payment status', { error: error.message, invoiceId });
      throw error;
    }
  }

  /**
   * Generate Payment Receipt
   * @param {String} paymentTrackingId - Payment tracking ID
   * @returns {Object} Receipt details
   */
  async generatePaymentReceipt(paymentTrackingId) {
    try {
      const payment = await PaymentTracking.findById(paymentTrackingId).populate('invoiceId');
      if (!payment) {
        throw new Error('Payment record not found');
      }

      const receiptNumber = `REC${Date.now()}${generateRandomString(4, 'NUMBERS')}`;
      
      // Generate receipt PDF (simplified version)
      const receiptData = {
        receiptNumber,
        paymentId: payment.paymentId,
        invoiceNumber: payment.invoiceId.invoiceNumber,
        amount: payment.amountDetails.paidAmount,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        clientName: payment.invoiceId.clientDetails.name
      };

      // In production, this would generate an actual PDF
      const receiptUrl = await this.createReceiptPDF(receiptData);

      // Update payment record
      payment.receipt = {
        receiptNumber,
        receiptUrl,
        receiptGeneratedAt: new Date()
      };

      await payment.save();

      return {
        receiptNumber,
        receiptUrl,
        paymentId: payment.paymentId
      };

    } catch (error) {
      logError('Error generating payment receipt', { error: error.message, paymentTrackingId });
      throw error;
    }
  }

  /**
   * Create Receipt PDF (Placeholder - would be implemented with actual PDF generation)
   * @param {Object} receiptData - Receipt data
   * @returns {String} Receipt URL
   */
  async createReceiptPDF(receiptData) {
    // This is a placeholder - in production, would generate actual PDF
    return `https://receipts.creatorsmantra.com/${receiptData.receiptNumber}.pdf`;
  }

  /**
   * Verify Payment
   * @param {String} paymentTrackingId - Payment tracking ID
   * @param {String} verifiedBy - User ID who verified
   * @param {String} notes - Verification notes
   * @returns {Object} Updated payment record
   */
  async verifyPayment(paymentTrackingId, verifiedBy, notes = '') {
    try {
      const payment = await PaymentTracking.findById(paymentTrackingId);
      if (!payment) {
        throw new Error('Payment record not found');
      }

      payment.verification = {
        isVerified: true,
        verifiedBy,
        verifiedAt: new Date(),
        verificationNotes: notes
      };

      payment.status = 'completed';
      await payment.save();

      // Generate receipt
      await this.generatePaymentReceipt(paymentTrackingId);

      logInfo('Payment verified successfully', { paymentTrackingId, verifiedBy });

      return payment;

    } catch (error) {
      logError('Error verifying payment', { error: error.message, paymentTrackingId });
      throw error;
    }
  }
}

// ============================================
// PAYMENT REMINDER SERVICE
// ============================================

class PaymentReminderService {

  /**
   * Schedule Payment Reminders for Invoice
   * @param {String} invoiceId - Invoice ID
   * @returns {Array} Scheduled reminders
   */
  async scheduleReminders(invoiceId) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const dueDate = invoice.invoiceSettings.dueDate;
      const reminders = [];

      // Reminder schedule: Day 0, 7, 14, 30 days past due
      const reminderSchedule = [
        { days: 0, type: 'gentle', subject: 'Payment Due - Invoice #{invoiceNumber}' },
        { days: 7, type: 'standard', subject: 'Payment Reminder - Invoice #{invoiceNumber}' },
        { days: 14, type: 'urgent', subject: 'Urgent: Payment Overdue - Invoice #{invoiceNumber}' },
        { days: 30, type: 'final_notice', subject: 'Final Notice - Invoice #{invoiceNumber}' }
      ];

      for (const reminder of reminderSchedule) {
        const scheduledDate = new Date(dueDate);
        scheduledDate.setDate(scheduledDate.getDate() + reminder.days);

        const reminderObj = new PaymentReminder({
          invoiceId,
          reminderType: reminder.type,
          scheduledDate,
          daysPastDue: reminder.days,
          subject: reminder.subject.replace('{invoiceNumber}', invoice.invoiceNumber),
          message: this.getReminderMessage(reminder.type, invoice),
          status: 'scheduled',
          delivery: {
            deliveryMethod: 'email',
            recipientEmail: invoice.clientDetails.email,
            recipientPhone: invoice.clientDetails.phone
          }
        });

        await reminderObj.save();
        reminders.push(reminderObj);
      }

      logInfo('Payment reminders scheduled', { invoiceId, reminderCount: reminders.length });

      return reminders;

    } catch (error) {
      logError('Error scheduling reminders', { error: error.message, invoiceId });
      throw error;
    }
  }

  /**
   * Get Reminder Message Template
   * @param {String} reminderType - Type of reminder
   * @param {Object} invoice - Invoice object
   * @returns {String} Reminder message
   */
  getReminderMessage(reminderType, invoice) {
    const amount = formatCurrency(invoice.taxSettings.taxCalculation.finalAmount);
    const invoiceNumber = invoice.invoiceNumber;
    const clientName = invoice.clientDetails.name;

    const templates = {
      gentle: `Dear ${clientName},

This is a gentle reminder that payment for Invoice ${invoiceNumber} amounting to ${amount} is now due.

Please process the payment at your earliest convenience.

Thank you for your business!

Best regards,
CreatorsMantra Team`,

      standard: `Dear ${clientName},

We notice that payment for Invoice ${invoiceNumber} (${amount}) is now 7 days overdue.

Please arrange payment as soon as possible to avoid any service interruptions.

If you have any questions, please contact us immediately.

Best regards,
CreatorsMantra Team`,

      urgent: `Dear ${clientName},

This is an urgent reminder that Invoice ${invoiceNumber} (${amount}) is now 14 days overdue.

Immediate payment is required. Please contact us if there are any issues with payment processing.

Failure to respond may result in additional charges or service suspension.

Best regards,
CreatorsMantra Team`,

      final_notice: `Dear ${clientName},

FINAL NOTICE: Invoice ${invoiceNumber} (${amount}) is now 30 days overdue.

This is our final reminder before we initiate collection procedures. 

Please contact us immediately to resolve this matter.

Best regards,
CreatorsMantra Team`
    };

    return templates[reminderType] || templates.gentle;
  }

  /**
   * Process Due Reminders
   * @returns {Object} Processing results
   */
  async processDueReminders() {
    try {
      const now = new Date();
      
      // Get reminders due for sending
      const dueReminders = await PaymentReminder.find({
        scheduledDate: { $lte: now },
        status: 'scheduled'
      }).populate('invoiceId');

      let sentCount = 0;
      let failedCount = 0;

      for (const reminder of dueReminders) {
        try {
          // Check if invoice is still unpaid
          if (reminder.invoiceId.status === 'paid') {
            reminder.status = 'cancelled';
            await reminder.save();
            continue;
          }

          // Send reminder
          await this.sendReminder(reminder);
          sentCount++;

        } catch (error) {
          logError('Error sending reminder', { 
            error: error.message, 
            reminderId: reminder._id 
          });
          
          reminder.status = 'failed';
          await reminder.save();
          failedCount++;
        }
      }

      logInfo('Reminder processing completed', { sentCount, failedCount });

      return { sentCount, failedCount, totalProcessed: dueReminders.length };

    } catch (error) {
      logError('Error processing due reminders', { error: error.message });
      throw error;
    }
  }

  /**
   * Send Individual Reminder
   * @param {Object} reminder - Reminder object
   * @returns {Boolean} Success status
   */
  async sendReminder(reminder) {
    try {
      const emailData = {
        to: reminder.delivery.recipientEmail,
        subject: reminder.subject,
        text: reminder.message,
        html: this.formatReminderHTML(reminder)
      };

      await sendEmail(emailData);

      // Update reminder status
      reminder.status = 'sent';
      reminder.delivery.sentAt = new Date();
      await reminder.save();

      return true;

    } catch (error) {
      logError('Error sending reminder email', { 
        error: error.message, 
        reminderId: reminder._id 
      });
      throw error;
    }
  }

  /**
   * Format Reminder as HTML
   * @param {Object} reminder - Reminder object
   * @returns {String} HTML content
   */
  formatReminderHTML(reminder) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #8B5CF6, #EC4899); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Payment Reminder</h1>
      </div>
      <div style="padding: 20px; background: white;">
        <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${reminder.message}</pre>
      </div>
      <div style="background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>This is an automated reminder from CreatorsMantra</p>
      </div>
    </div>`;
  }
}

// ============================================
// PDF GENERATION SERVICE
// ============================================

class PDFGenerationService {

  /**
   * Generate Invoice PDF
   * @param {String} invoiceId - Invoice ID
   * @param {String} templateId - Template ID (optional)
   * @returns {Object} PDF generation result
   */
  async generateInvoicePDF(invoiceId, templateId = null) {
    try {
      logInfo('Generating invoice PDF', { invoiceId, templateId });

      // Get invoice with populated data
      const invoice = await Invoice.findById(invoiceId)
        .populate('dealReferences.dealId')
        .populate('dealReferences.dealIds')
        .populate('creatorId');

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Get template
      let template = null;
      if (templateId) {
        template = await InvoiceTemplate.findById(templateId);
      } else {
        // Use default template
        template = await InvoiceTemplate.findOne({ 
          creatorId: invoice.creatorId,
          isDefault: true 
        });
      }

      if (!template) {
        template = this.getDefaultTemplate();
      }

      // Generate PDF buffer
      const pdfBuffer = await this.createPDFBuffer(invoice, template);

      // Upload to S3
      const fileName = `invoices/${invoice.invoiceNumber}.pdf`;
      const pdfUrl = await uploadToS3(pdfBuffer, fileName, 'application/pdf');

      // Update invoice with PDF info
      invoice.metadata.pdfUrl = pdfUrl;
      invoice.metadata.pdfGeneratedAt = new Date();
      invoice.metadata.templateId = template._id;
      await invoice.save();

      logInfo('Invoice PDF generated successfully', { 
        invoiceId, 
        pdfUrl, 
        templateId: template._id 
      });

      return {
        pdfUrl,
        fileName,
        templateUsed: template.templateName
      };

    } catch (error) {
      logError('Error generating invoice PDF', { error: error.message, invoiceId });
      throw error;
    }
  }

  /**
   * Create PDF Buffer from Invoice Data
   * @param {Object} invoice - Invoice object
   * @param {Object} template - Template object
   * @returns {Buffer} PDF buffer
   */
  async createPDFBuffer(invoice, template) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Generate PDF content
        this.generatePDFContent(doc, invoice, template);
        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate PDF Content
   * @param {Object} doc - PDF document
   * @param {Object} invoice - Invoice object
   * @param {Object} template - Template object
   */
  generatePDFContent(doc, invoice, template) {
    const primaryColor = template.design?.primaryColor || '#8B5CF6';
    const secondaryColor = template.design?.secondaryColor || '#EC4899';

    // Header
    this.generateHeader(doc, invoice, template, primaryColor);
    
    // Invoice details
    this.generateInvoiceDetails(doc, invoice);
    
    // Client details
    this.generateClientDetails(doc, invoice);
    
    // Line items table
    this.generateLineItemsTable(doc, invoice);
    
    // Tax calculations
    this.generateTaxCalculations(doc, invoice);
    
    // Payment details
    this.generatePaymentDetails(doc, invoice);
    
    // Footer
    this.generateFooter(doc, invoice, template);
  }

  /**
   * Generate PDF Header
   * @param {Object} doc - PDF document
   * @param {Object} invoice - Invoice object
   * @param {Object} template - Template object
   * @param {String} primaryColor - Primary color
   */
  generateHeader(doc, invoice, template, primaryColor) {
    // Header background
    doc.rect(0, 0, doc.page.width, 100)
       .fill(primaryColor);

    // Logo and company name
    doc.fillColor('white')
       .fontSize(24)
       .text('INVOICE', 50, 30);

    if (template.branding?.companyName) {
      doc.fontSize(16)
         .text(template.branding.companyName, 350, 35);
    }

    // Invoice number
    doc.fontSize(14)
       .text(`Invoice #: ${invoice.invoiceNumber}`, 50, 60);

    // Reset position
    doc.y = 120;
    doc.fillColor('black');
  }

  /**
   * Generate Invoice Details Section
   * @param {Object} doc - PDF document
   * @param {Object} invoice - Invoice object
   */
  generateInvoiceDetails(doc, invoice) {
    const startY = doc.y;

    doc.fontSize(12)
       .text('Invoice Date:', 50, startY)
       .text(invoice.invoiceSettings.invoiceDate.toLocaleDateString(), 150, startY)
       .text('Due Date:', 50, startY + 20)
       .text(invoice.invoiceSettings.dueDate.toLocaleDateString(), 150, startY + 20)
       .text('Payment Terms:', 50, startY + 40)
       .text(`${invoice.invoiceSettings.paymentTerms} days`, 150, startY + 40);

    doc.y = startY + 70;
  }

  /**
   * Generate Client Details Section
   * @param {Object} doc - PDF document
   * @param {Object} invoice - Invoice object
   */
  generateClientDetails(doc, invoice) {
    const startY = doc.y;

    doc.fontSize(14)
       .text('Bill To:', 50, startY);

    doc.fontSize(12)
       .text(invoice.clientDetails.name, 50, startY + 25)
       .text(invoice.clientDetails.email || '', 50, startY + 45)
       .text(invoice.clientDetails.phone || '', 50, startY + 65);

    // Address
    if (invoice.clientDetails.address) {
      const address = invoice.clientDetails.address;
      const fullAddress = [
        address.street,
        address.city,
        address.state,
        address.pincode
      ].filter(Boolean).join(', ');

      if (fullAddress) {
        doc.text(fullAddress, 50, startY + 85);
      }
    }

    doc.y = startY + 120;
  }

  /**
   * Generate Line Items Table
   * @param {Object} doc - PDF document
   * @param {Object} invoice - Invoice object
   */
  generateLineItemsTable(doc, invoice) {
    const startY = doc.y;
    const tableTop = startY;
    const itemHeight = 25;

    // Table headers
    doc.fontSize(12)
       .text('Description', 50, tableTop)
       .text('Qty', 300, tableTop)
       .text('Rate', 350, tableTop)
       .text('Amount', 450, tableTop);

    // Header line
    doc.moveTo(50, tableTop + 15)
       .lineTo(500, tableTop + 15)
       .stroke();

    // Line items
    let currentY = tableTop + 25;
    invoice.lineItems.forEach((item, index) => {
      doc.fontSize(10)
         .text(item.description, 50, currentY, { width: 240 })
         .text(item.quantity.toString(), 300, currentY)
         .text(`₹${item.rate.toLocaleString()}`, 350, currentY)
         .text(`₹${item.amount.toLocaleString()}`, 450, currentY);

      currentY += itemHeight;
    });

    doc.y = currentY + 10;
  }

  /**
   * Generate Tax Calculations Section
   * @param {Object} doc - PDF document
   * @param {Object} invoice - Invoice object
   */
  generateTaxCalculations(doc, invoice) {
    const calc = invoice.taxSettings.taxCalculation;
    const startY = doc.y;

    // Subtotal
    doc.fontSize(12)
       .text('Subtotal:', 350, startY)
       .text(`₹${calc.subtotal.toLocaleString()}`, 450, startY);

    let currentY = startY + 20;

    // Discount
    if (calc.totalDiscount > 0) {
      doc.text('Discount:', 350, currentY)
         .text(`-₹${calc.totalDiscount.toLocaleString()}`, 450, currentY);
      currentY += 20;
    }

    // GST
    if (invoice.taxSettings.gstSettings.applyGST) {
      if (invoice.taxSettings.gstSettings.gstType === 'igst') {
        doc.text('IGST (18%):', 350, currentY)
           .text(`₹${calc.igstAmount.toLocaleString()}`, 450, currentY);
      } else {
        doc.text('CGST (9%):', 350, currentY)
           .text(`₹${calc.cgstAmount.toLocaleString()}`, 450, currentY);
        currentY += 20;
        doc.text('SGST (9%):', 350, currentY)
           .text(`₹${calc.sgstAmount.toLocaleString()}`, 450, currentY);
      }
      currentY += 20;
    }

    // TDS
    if (invoice.taxSettings.tdsSettings.applyTDS) {
      doc.text(`TDS (${invoice.taxSettings.tdsSettings.tdsRate}%):`, 350, currentY)
         .text(`-₹${calc.tdsAmount.toLocaleString()}`, 450, currentY);
      currentY += 20;
    }

    // Total line
    doc.moveTo(350, currentY)
       .lineTo(500, currentY)
       .stroke();

    currentY += 10;

    // Final amount
    doc.fontSize(14)
       .text('Total Amount:', 350, currentY)
       .text(`₹${calc.finalAmount.toLocaleString()}`, 450, currentY);

    doc.y = currentY + 30;
  }

  /**
   * Generate Payment Details Section
   * @param {Object} doc - PDF document
   * @param {Object} invoice - Invoice object
   */
  generatePaymentDetails(doc, invoice) {
    const startY = doc.y;

    doc.fontSize(12)
       .text('Payment Details:', 50, startY);

    const bank = invoice.bankDetails;
    doc.fontSize(10)
       .text(`Account Name: ${bank.accountName}`, 50, startY + 25)
       .text(`Account Number: ${bank.accountNumber}`, 50, startY + 45)
       .text(`Bank: ${bank.bankName}`, 50, startY + 65)
       .text(`IFSC: ${bank.ifscCode}`, 50, startY + 85);

    if (bank.upiId) {
      doc.text(`UPI ID: ${bank.upiId}`, 50, startY + 105);
    }

    doc.y = startY + 130;
  }

  /**
   * Generate PDF Footer
   * @param {Object} doc - PDF document
   * @param {Object} invoice - Invoice object
   * @param {Object} template - Template object
   */
  generateFooter(doc, invoice, template) {
    const bottomMargin = 50;
    const footerY = doc.page.height - bottomMargin - 100;

    // Terms and conditions
    if (invoice.invoiceSettings.termsAndConditions) {
      doc.y = footerY - 60;
      doc.fontSize(8)
         .text('Terms & Conditions:', 50, doc.y)
         .text(invoice.invoiceSettings.termsAndConditions, 50, doc.y + 15, {
           width: 500,
           height: 60
         });
    }

    // Footer line
    doc.moveTo(50, footerY)
       .lineTo(500, footerY)
       .stroke();

    // Thank you message
    doc.fontSize(10)
       .text('Thank you for your business!', 50, footerY + 15);

    // Generated timestamp
    doc.fontSize(8)
       .text(`Generated on ${new Date().toLocaleString()}`, 400, footerY + 15);
  }

  /**
   * Get Default Template
   * @returns {Object} Default template object
   */
  getDefaultTemplate() {
    return {
      templateName: 'Default',
      templateType: 'professional',
      design: {
        primaryColor: '#8B5CF6',
        secondaryColor: '#EC4899',
        fontFamily: 'Inter'
      },
      branding: {
        companyName: 'CreatorsMantra'
      }
    };
  }
}

// ============================================
// EXPORT SERVICES
// ============================================

module.exports = {
  PaymentTrackingService: new PaymentTrackingService(),
  PaymentReminderService: new PaymentReminderService(),
  PDFGenerationService: new PDFGenerationService()
};