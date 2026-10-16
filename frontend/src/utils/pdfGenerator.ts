import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Options configuration for invoice PDF download.
 */
export interface GenerateInvoicePdfOptions {
  /** HTML element or container ID holding the clean printable invoice sheet */
  element: HTMLElement;
  /** Output filename without extension, e.g. "INV-2026-0001" */
  filename: string;
}

/**
 * Renders an HTML invoice element onto an A4 PDF and triggers browser download.
 *
 * @param options - Configuration containing target DOM element and desired filename.
 * @returns Promise resolving when PDF file download is initiated.
 */
export async function generateInvoicePdf({ element, filename }: GenerateInvoicePdfOptions): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2, // 2x scale ensures crisp text and sharp lines on standard 300 DPI printers
    useCORS: true, // Allows rendering external images like business logos
    logging: false,
    backgroundColor: '#ffffff', // Guarantee solid white paper background
  });

  const imgData = canvas.toDataURL('image/png');

  // Initialize jsPDF in portrait mode with standard millimeter units for A4 dimensions (210 x 297 mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = 210;
  const pageHeight = 297;
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  // First page
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  // Handle multi-page invoices seamlessly if invoice line items exceed a single A4 page
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  // Trigger client-side save dialog
  pdf.save(`${filename}.pdf`);
}
