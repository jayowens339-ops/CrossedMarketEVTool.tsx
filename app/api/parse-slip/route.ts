import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Optional: You can remove this line if Vercel shows a warning
export const runtime = "edge";

async function fileToBase64(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buf.toString("base64")}`;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const image = form.get("image");
    if (!image || !(image instanceof File)) {
      return NextResponse.json({ error: "No image provided (field 'image')." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const b64 = await fileToBase64(image);

    const prompt = `You are a sports prop slip parser. Extract props from the screenshot and return JSON:
{
  "source": "prizepicks" | "underdog" | "other",
  "entries": [{
    "player": string,
    "market": string,
    "line": number,
    "selection": "over"|"under"|"n/a",
    "odds": string | null,
    "book": string | null,
    "rawText": string
  }]
}
Only output JSON.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Convert screenshots of prop slips into strict JSON." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: b64 } }
          ] as any
        }
      ],
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}$/);
      parsed = m ? JSON.parse(m[0]) : { error: "Parse error", raw };
    }

    return NextResponse.json({ ...parsed, extractedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
