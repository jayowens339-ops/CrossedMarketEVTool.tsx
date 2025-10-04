import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function GET(req: NextRequest) {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Make a simple API call to check connection
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say 'hello world' in one word." }],
    });

    const message = completion.choices[0]?.message?.content || "No response";

    return NextResponse.json({ success: true, reply: message });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message || err }, { status: 500 });
  }
}
