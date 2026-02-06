import { expect } from 'chai';
import * as sinon from 'sinon';
import './mocks/vscode-mock';
import './mocks/cxWrapper-mock';
import { mockDiagnosticCollection } from './mocks/vscode-mock';
import { AscaScannerService } from '../realtimeScanners/scanners/asca/ascaScannerService';
import type CxAsca from "@checkmarx/ast-cli-javascript-wrapper/dist/main/asca/CxAsca";
import type { Uri } from 'vscode';
import { constants } from '../utils/common/constants';
import { setExtensionConfig, resetExtensionConfig } from '../config/extensionConfig';

describe('AscaScannerService', () => {
    let ascaService: AscaScannerService;
    let mockUri: Uri;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Set up extension configuration before tests run
        setExtensionConfig({
            extensionId: 'ast-results',
            commandPrefix: 'ast-results',
            viewContainerPrefix: 'ast',
            displayName: 'Checkmarx',
            extensionType: 'checkmarx',
        });

        ascaService = new AscaScannerService();
        mockUri = {
            fsPath: '/test/path/TestFile.java',
            scheme: 'file'
        } as Uri;
        mockDiagnosticCollection.set.reset();
        mockDiagnosticCollection.delete.reset();
    });

    afterEach(() => {
        sandbox.restore();
        resetExtensionConfig();
    });

    describe('shouldScanFile', () => {
        it('should return true for supported file extensions', () => {
            const supportedFiles = [
                { fsPath: '/test/file.java', scheme: 'file' },
                { fsPath: '/test/file.cs', scheme: 'file' },
                { fsPath: '/test/file.go', scheme: 'file' },
                { fsPath: '/test/file.py', scheme: 'file' },
                { fsPath: '/test/file.js', scheme: 'file' },
                { fsPath: '/test/file.jsx', scheme: 'file' }
            ];

            supportedFiles.forEach(file => {
                const mockDocument = { uri: file } as any;
                expect(ascaService.shouldScanFile(mockDocument)).to.be.true;
            });
        });

        it('should return false for unsupported file extensions', () => {
            const unsupportedFiles = [
                { fsPath: '/test/file.txt', scheme: 'file' },
                { fsPath: '/test/file.html', scheme: 'file' },
                { fsPath: '/test/file.css', scheme: 'file' },
                { fsPath: '/test/file.xml', scheme: 'file' }
            ];

            unsupportedFiles.forEach(file => {
                const mockDocument = { uri: file } as any;
                expect(ascaService.shouldScanFile(mockDocument)).to.be.false;
            });
        });

        it('should return false for non-file schemes', () => {
            const mockDocument = {
                uri: { fsPath: '/test/file.java', scheme: 'untitled' }
            } as any;
            expect(ascaService.shouldScanFile(mockDocument)).to.be.false;
        });
    });

    describe('updateProblems', () => {
        it.skip('should create diagnostics with correct range based on leading whitespace', () => {
            const mockScanResult: CxAsca = {
                scanDetails: [
                    {
                        line: 1,
                        problematicLine: '  const unsafeCode = eval("2+2");',  // 2 spaces
                        ruleName: 'Avoid Eval Usage',
                        description: 'Using eval() can lead to code injection vulnerabilities',
                        remediationAdvise: 'Use safer alternatives to eval()',
                        severity: 'HIGH',
                        ruleId: 12345
                    },
                    {
                        line: 2,
                        problematicLine: '    console.log(secret);',  // 4 spaces
                        ruleName: 'Hardcoded Secret',
                        description: 'Hardcoded secrets should not be stored in code',
                        remediationAdvise: 'Use environment variables for secrets',
                        severity: 'CRITICAL',
                        ruleId: 12346
                    }
                ]
            } as CxAsca;

            ascaService.updateProblems(mockScanResult, mockUri);

            const diagnostics = mockDiagnosticCollection.set.getCall(0).args[1];

            // Check first diagnostic
            expect(diagnostics[0].range.start.line).to.equal(0);
            expect(diagnostics[0].range.start.character).to.equal(2);
            expect(diagnostics[0].range.end.line).to.equal(0);
            expect(diagnostics[0].range.end.character).to.equal(33);
            expect(diagnostics[0].message).to.equal('Avoid Eval Usage');
            expect(diagnostics[0].source).to.equal(constants.getCxAi());
            expect(diagnostics[0].severity).to.equal(0);

            // Check second diagnostic
            expect(diagnostics[1].range.start.line).to.equal(1);
            expect(diagnostics[1].range.start.character).to.equal(4);
            expect(diagnostics[1].range.end.line).to.equal(1);
            expect(diagnostics[1].range.end.character).to.equal(24);
            expect(diagnostics[1].message).to.equal('Hardcoded Secret');
            expect(diagnostics[1].source).to.equal(constants.getCxAi());
            expect(diagnostics[1].severity).to.equal(0);
        });

        it('should store hover data correctly', () => {
            const mockScanResult: CxAsca = {
                scanDetails: [
                    {
                        line: 1,
                        problematicLine: '  const unsafeCode = eval("2+2");',
                        ruleName: 'Avoid Eval Usage',
                        description: 'Using eval() can lead to code injection vulnerabilities',
                        remediationAdvise: 'Use safer alternatives to eval()',
                        severity: 'HIGH'
                    }
                ]
            } as CxAsca;

            ascaService.updateProblems(mockScanResult, mockUri);

            const hoverData = ascaService.getHoverData();
            const key = `${mockUri.fsPath}:0`; // line - 1
            const storedData = hoverData.get(key);

            expect(storedData).to.exist;
            expect(storedData[0].ruleName).to.equal('Avoid Eval Usage');
            expect(storedData[0].description).to.equal('Using eval() can lead to code injection vulnerabilities');
            expect(storedData[0].severity).to.equal('HIGH');
            expect(storedData[0].remediationAdvise).to.equal('Use safer alternatives to eval()');
            expect(storedData[0].location.line).to.equal(0);
            expect(storedData[0].location.startIndex).to.equal(2);
            expect(storedData[0].location.endIndex).to.equal(33);
        });

        it('should handle missing description by using remediationAdvise', () => {
            const mockScanResult: CxAsca = {
                scanDetails: [
                    {
                        line: 1,
                        problematicLine: '  const test = "value";',
                        ruleName: 'Test Rule',
                        remediationAdvise: 'Fix this issue',
                        severity: 'MEDIUM'
                        // No description field
                    }
                ]
            } as CxAsca;

            ascaService.updateProblems(mockScanResult, mockUri);

            const hoverData = ascaService.getHoverData();
            const key = `${mockUri.fsPath}:0`;
            const storedDataArray = hoverData.get(key);

            expect(storedDataArray).to.exist;
            expect(storedDataArray).to.be.an('array');
            expect(storedDataArray.length).to.equal(1);

            const storedData = storedDataArray[0];
            expect(storedData.description).to.equal('Fix this issue'); // Should use remediationAdvise
        });

        it.skip('should handle multiple problems on the same line', () => {
            const mockScanResult: CxAsca = {
                scanDetails: [
                    {
                        line: 1,
                        problematicLine: '  const x = eval("test") + secret;',
                        ruleName: 'Avoid Eval Usage',
                        description: 'Using eval() can lead to code injection',
                        remediationAdvise: 'Use safer alternatives to eval()',
                        severity: 'HIGH',
                        ruleId: 12345
                    },
                    {
                        line: 1, // Same line
                        problematicLine: '  const x = eval("test") + secret;',
                        ruleName: 'Hardcoded Secret',
                        description: 'Secrets should not be hardcoded',
                        remediationAdvise: 'Use environment variables',
                        severity: 'CRITICAL',
                        ruleId: 12346
                    }
                ]
            } as CxAsca;

            ascaService.updateProblems(mockScanResult, mockUri);

            const diagnostics = mockDiagnosticCollection.set.getCall(0).args[1];

            // Should create only one diagnostic for the line with multiple problems
            expect(diagnostics).to.have.length(1);
            expect(diagnostics[0].message).to.equal('2 ASCA violations detected on this line');
            expect(diagnostics[0].range.start.line).to.equal(0); // line - 1

            // Check hover data contains both problems
            const hoverData = ascaService.getHoverData();
            const key = `${mockUri.fsPath}:0`;
            const storedDataArray = hoverData.get(key);

            expect(storedDataArray).to.exist;
            expect(storedDataArray).to.be.an('array');
            expect(storedDataArray.length).to.equal(2);

            expect(storedDataArray[0].ruleName).to.equal('Avoid Eval Usage');
            expect(storedDataArray[1].ruleName).to.equal('Hardcoded Secret');
        });
    });

    describe('clearProblems', () => {
        it('should clear all stored data', async () => {
            // First add some data
            const mockScanResult: CxAsca = {
                scanDetails: [
                    {
                        line: 1,
                        problematicLine: '  test',
                        ruleName: 'Test Rule',
                        remediationAdvise: 'Test Advice',
                        severity: 'LOW',
                        ruleId: 12347
                    }
                ]
            } as CxAsca;

            ascaService.updateProblems(mockScanResult, mockUri);

            // Verify data exists
            expect(ascaService.getHoverData().size).to.be.greaterThan(0);
            expect(ascaService.getDiagnosticsMap().size).to.be.greaterThan(0);

            // Clear problems
            await ascaService.clearProblems();

            // Verify data is cleared
            expect(ascaService.getHoverData().size).to.equal(0);
            expect(ascaService.getDiagnosticsMap().size).to.equal(0);
        });
    });
});
