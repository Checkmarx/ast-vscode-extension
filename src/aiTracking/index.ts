/**
 * AI Fix Tracking Module
 * 
 * This module tracks AI fix suggestions and their outcomes to provide telemetry
 * on whether users adopt MCP recommendations, use alternatives, or reject fixes.
 * 
 * Key components:
 * - AISuggestionTracker: Singleton service that tracks pending fixes and outcomes
 * - McpClient: Direct client for fetching MCP recommendations
 * - Types: Interfaces and types for fix tracking data structures
 */

export { AISuggestionTracker } from './AISuggestionTracker';
export { McpClient } from './mcpClient';
export * from './types';

