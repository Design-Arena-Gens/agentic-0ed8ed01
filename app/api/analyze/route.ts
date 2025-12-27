import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface RaviResult {
  bookName: string;
  status: 'Thiqah' | 'Zaeef' | 'Unknown';
  page: number;
  context: string;
}

// Parse PDF in chunks to handle large files
async function parsePDFText(buffer: Buffer): Promise<{ text: string; pages: string[] }> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);

    // Split text by page markers (approximation)
    const fullText = data.text;
    const numPages = data.numpages;
    const avgCharsPerPage = fullText.length / numPages;

    const pages: string[] = [];
    for (let i = 0; i < numPages; i++) {
      const start = Math.floor(i * avgCharsPerPage);
      const end = Math.floor((i + 1) * avgCharsPerPage);
      pages.push(fullText.substring(start, end));
    }

    return { text: fullText, pages };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF');
  }
}

function searchRaviInText(pages: string[], bookName: string): RaviResult[] {
  const results: RaviResult[] = [];
  const raviPattern = /ravi/gi;

  pages.forEach((pageText, pageIndex) => {
    if (raviPattern.test(pageText)) {
      // Extract context around "Ravi"
      const matches = Array.from(pageText.matchAll(/(.{0,100}ravi.{0,100})/gi));

      for (const match of matches) {
        let context = match[0].trim();

        // Determine status based on keywords
        const lowerContext = context.toLowerCase();
        let status: 'Thiqah' | 'Zaeef' | 'Unknown' = 'Unknown';

        // Common terms in Islamic hadith criticism
        const thiqahTerms = [
          'thiqah', 'thiqa', 'trustworthy', 'reliable', 'authentic',
          'صدوق', 'ثقة', 'موثوق', 'acceptable', 'sound', 'strong'
        ];

        const zaeefTerms = [
          'zaeef', 'daeef', 'weak', 'unreliable', 'doubtful',
          'ضعيف', 'متروك', 'rejected', 'fabricated', 'poor'
        ];

        if (thiqahTerms.some(term => lowerContext.includes(term.toLowerCase()))) {
          status = 'Thiqah';
        } else if (zaeefTerms.some(term => lowerContext.includes(term.toLowerCase()))) {
          status = 'Zaeef';
        }

        results.push({
          bookName,
          status,
          page: pageIndex + 1,
          context: context.length > 200 ? context.substring(0, 200) + '...' : context
        });
      }
    }
  });

  return results;
}

async function analyzeWithAI(text: string, bookName: string, pages: string[]): Promise<RaviResult[]> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
  });

  const results: RaviResult[] = [];

  // Search for Ravi references first
  const raviPages: { pageNum: number; text: string }[] = [];
  pages.forEach((pageText, idx) => {
    if (/ravi/gi.test(pageText)) {
      raviPages.push({ pageNum: idx + 1, text: pageText });
    }
  });

  if (raviPages.length === 0) {
    return [];
  }

  // Process each page with Ravi references
  for (const page of raviPages.slice(0, 10)) { // Limit to first 10 occurrences
    try {
      const prompt = `Analyze this text from page ${page.pageNum} of the book "${bookName}".

Text:
${page.text.substring(0, 3000)}

Task: Find any reference to "Ravi" (narrator/transmitter) and determine their status in Islamic hadith science:
- Is the narrator described as "Thiqah" (trustworthy/reliable)?
- Is the narrator described as "Zaeef/Daeef" (weak/unreliable)?
- Look for Arabic terms: ثقة (thiqah), ضعيف (daeef), صدوق (truthful), متروك (abandoned), etc.

Respond in JSON format:
{
  "found": true/false,
  "status": "Thiqah" or "Zaeef" or "Unknown",
  "context": "relevant excerpt mentioning Ravi and their status"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        try {
          const parsed = JSON.parse(response);
          if (parsed.found) {
            results.push({
              bookName,
              status: parsed.status,
              page: page.pageNum,
              context: parsed.context || 'Reference found'
            });
          }
        } catch (e) {
          console.error('Failed to parse AI response:', e);
        }
      }
    } catch (error) {
      console.error('AI analysis error:', error);
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const allResults: RaviResult[] = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const { text, pages } = await parsePDFText(buffer);

        // First try keyword-based search (fast)
        let results = searchRaviInText(pages, file.name);

        // If OpenAI API key is available, enhance results with AI
        if (process.env.OPENAI_API_KEY && results.length > 0) {
          try {
            const aiResults = await analyzeWithAI(text, file.name, pages);
            if (aiResults.length > 0) {
              results = aiResults;
            }
          } catch (aiError) {
            console.error('AI enhancement failed, using keyword results:', aiError);
          }
        }

        allResults.push(...results);
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        // Continue with other files
      }
    }

    return NextResponse.json({
      results: allResults,
      totalFound: allResults.length
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    );
  }
}
