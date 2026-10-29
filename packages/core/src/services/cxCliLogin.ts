import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import { CxWrapper } from '@checkmarx/ast-cli-javascript-wrapper';
import { CxConfig } from '@checkmarx/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig';
import { Logs } from '../models/logs';
import { constants } from '../utils/common/constants';

/**
 * Shares the extension's sign-in with the cx CLI, so cx-devassist sees the same login. The gate in
 * cx-devassist checks the login with `cx auth validate`, and cx keeps one login per user (in the OS
 * credential store or its config file), which this extension's bundled cx and the installed cx share.
 *
 * Why this calls execFile directly instead of the wrapper:
 * - cx `configure set` has no stdin option, so the value must be an argument. The argument is visible
 *   to other processes of the same user while the command runs.
 * - The wrapper rewrites arguments (it strips quotes) and logs every line cx prints. cx echoes the value
 *   it sets, so going through the wrapper would put the token in the extension log.
 */

const CX_APIKEY_PROP = 'cx_apikey';
const CX_TIMEOUT_MS = 30000;

export const cxCliLoginMessages = {
	shareFailed: 'Signed in, but cx-devassist could not get this login. Sign in again, or run "cx auth login" in a terminal.',
	removeFailed: 'Signed out, but cx-devassist may still be signed in. Run "cx auth logout" in a terminal.',
};

type ExecFile = typeof childProcess.execFile;
let execFileImpl: ExecFile = childProcess.execFile;

/** Unit tests only: replaces how cx is run. Pass nothing to restore the real execFile. */
export function setExecFileForTests(impl?: ExecFile): void {
	execFileImpl = impl ?? childProcess.execFile;
}

function cxExecutablePath(): string {
	return new CxWrapper(new CxConfig()).config.pathToExecutable;
}

/**
 * UI and integration tests run with TEST set, against a mock that accepts any token (and a command that
 * saves a fake one). Never let that token replace the developer's real cx login.
 */
function isTestRun(): boolean {
	return !!process.env.TEST;
}

/** Runs cx and resolves true on exit code 0. Logs failures only when `logs` is given. */
function runCx(args: string[], description: string, logs?: Logs): Promise<boolean> {
	return new Promise((resolve) => {
		execFileImpl(cxExecutablePath(), args, { windowsHide: true, timeout: CX_TIMEOUT_MS }, (error) => {
			// Never log stdout or stderr here: cx may echo the value, and the value is the token.
			if (error) {
				logs?.error(`cx ${description} failed (exit code ${(error as NodeJS.ErrnoException).code ?? 'unknown'})`);
				resolve(false);
				return;
			}
			resolve(true);
		});
	});
}

function setCxApiKey(value: string, logs?: Logs): Promise<boolean> {
	return runCx(['configure', 'set', '--prop-name', CX_APIKEY_PROP, '--prop-value', value], `configure set ${CX_APIKEY_PROP}`, logs);
}

/**
 * Stores the signed-in token in the cx CLI. Call it only after a real sign-in, never from a routine
 * validation, since each call passes the token as an argument. Warns the user when cx fails.
 */
export async function shareLoginWithCxCli(token: string, logs?: Logs): Promise<boolean> {
	if (isTestRun()) {
		return false;
	}
	const ok = await setCxApiKey(token, logs);
	if (!ok) {
		vscode.window.showWarningMessage(cxCliLoginMessages.shareFailed);
	}
	return ok;
}

/**
 * Clears the token from the cx CLI on sign out, so cx-devassist is signed out too.
 * Assumes that `configure set` with an empty value removes the key. Not verified against cx yet.
 */
export async function removeLoginFromCxCli(logs?: Logs): Promise<boolean> {
	if (isTestRun()) {
		return false;
	}
	const ok = await setCxApiKey('', logs);
	if (!ok) {
		vscode.window.showWarningMessage(cxCliLoginMessages.removeFailed);
	}
	return ok;
}

/** True when the cx CLI already has a working login. cx reads the OS credential store or its file itself. */
export function isCxCliSignedIn(): Promise<boolean> {
	// Not signed in is an expected answer here, so failures are not logged.
	return runCx(['auth', 'validate'], 'auth validate');
}

/**
 * Startup: covers users who signed in to the extension before it shared logins with cx. Call it only
 * when the extension's own login is valid. Hands the token over once, and only when cx has no working
 * login, so an existing cx login is left alone.
 */
export async function syncLoginWithCxCli(context: vscode.ExtensionContext, logs?: Logs): Promise<void> {
	if (isTestRun()) {
		return;
	}
	try {
		const token = await context.secrets.get(constants.getAuthCredentialSecretKey());
		if (!token || await isCxCliSignedIn()) {
			return;
		}
		await shareLoginWithCxCli(token, logs);
	} catch (error) {
		logs?.error(`Could not share the login with the cx CLI: ${error}`);
	}
}
