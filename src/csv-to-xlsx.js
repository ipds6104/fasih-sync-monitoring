import ExcelJS from "exceljs";
import fs from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Simple CSV parser that handles double quotes and escapes
function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function convert(csvPath, xlsxPath) {
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  // Clean BOM if present
  const lines = csvContent.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim() !== "");

  if (lines.length === 0) {
    console.warn("CSV is empty");
    process.exit(0);
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Prelist Sakernas");

  // Parse headers
  const headers = parseCsvLine(lines[0]);
  worksheet.addRow(headers);

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    worksheet.addRow(parseCsvLine(lines[i]));
  }

  // Format styles
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Segoe UI", size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2E4053" } // Sleek Dark slate gray header
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  // Set borders and font for all cells
  worksheet.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 25 : 20;
    row.eachCell((cell) => {
      if (rowNumber > 1) {
        cell.font = { name: "Segoe UI", size: 10 };
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } }
      };
      
      // Zebra striping for data rows
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" } // Light gray zebra row
        };
      }
    });
  });

  // Freeze header row
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  // Auto-fit column widths
  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const valStr = cell.value ? String(cell.value) : "";
      if (valStr.length > maxLen) maxLen = valStr.length;
    });
    column.width = Math.max(maxLen + 4, 12);
  });

  // Save workbook
  await workbook.xlsx.writeFile(xlsxPath);
  console.log(`✓ Excel file generated at: ${xlsxPath}`);
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node csv-to-xlsx.js <csvPath> <xlsxPath>");
  process.exit(1);
}

convert(args[0], args[1]);
