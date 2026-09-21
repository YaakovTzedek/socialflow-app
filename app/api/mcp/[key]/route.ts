import { NextRequest } from 'next/server';
import { mcpDelete, mcpGet, mcpOptions, mcpPost } from '@/lib/mcp-http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Same MCP endpoint with the key in the path, for clients that cannot send headers (ChatGPT connectors).
export async function POST(req: NextRequest, { params }: { params: { key: string } }) { return mcpPost(req, params.key); }
export async function GET(req: NextRequest) { return mcpGet(req); }
export async function DELETE() { return mcpDelete(); }
export async function OPTIONS() { return mcpOptions(); }
