/**
 * Shared activation logic for Checkmarx extensions
 *
 * This module exports activation functions for:
 * - Core shared functionality (both extensions)
 * - Checkmarx One specific features (cloud-based)
 * - DevConnect specific features (realtime/standalone)
 */

// Export activation functions
export { activateCore, setupCommonStatusBars, registerCommonCommands } from './activateCore';
export { activateCxOne } from './activateCxOne';
export { activateProjectIgnite } from './activateProjectIgnite';

