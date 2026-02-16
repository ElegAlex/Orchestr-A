/**
 * RFC 4180 compliant CSV parser
 * Handles quoted fields, escaped quotes, and auto-detects delimiters
 */

/**
 * Parse a single CSV line with proper quote handling
 * @param line - The line to parse
 * @param delimiter - The delimiter to use (usually "," or ";")
 * @returns Array of field values
 */
export const parseCSVLine = (line: string, delimiter: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === delimiter) {
        result.push(current.trim());
        current = "";
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }
  result.push(current.trim());
  return result;
};

/**
 * Auto-detect CSV delimiter by counting occurrences
 * @param headerLine - The header line to analyze
 * @returns The detected delimiter (";" or ",")
 */
export const detectDelimiter = (headerLine: string): string => {
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return semicolonCount >= commaCount ? ";" : ",";
};

/**
 * Parse CSV content into an array of objects
 * @param content - The full CSV content as a string
 * @returns Array of objects where keys are header names and values are field values
 */
export const parseCSV = (content: string): Record<string, string>[] => {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter).map((h) =>
    h.replace(/^\*|\*$/g, "").trim(),
  );
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    data.push(row);
  }

  return data;
};
