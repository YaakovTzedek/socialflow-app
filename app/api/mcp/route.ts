import { NextRequest } from 'next/server';
import { mcpDelete, mcpGet, mcpOptions, mcpPost } from '@/lib/mcp-http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// MCP endpoint (Streamable HTTP). Key via "Authorization: Bearer <key>" or ?key=.
export async function POST(req: NextRequest) { return mcpPost(req); }
export async function GET(req: NextRequest) { return mcpGet(req); }
export async function DELETE() { return mcpDelete(); }
export async function OPTIONS() { return mcpOptions(); }
