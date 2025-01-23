import { expect } from 'chai';
import * as sinon from 'sinon';
import './mocks/vscode-mock';
import './mocks/cxWrapper-mock';
import { mockDiagnosticCollection } from './mocks/vscode-mock';
import { updateProblems } from '../asca/ascaService';
import type CxAsca from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/asca/CxAsca";
import type { Uri } from 'vscode';

describe('ascaService', () => {
    let mockUri: Uri;
    let sandbox: sinon.SinonSandbox;
    
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockUri = {
            fsPath: '/test/path',
            scheme: 'file'
        } as Uri;
        mockDiagnosticCollection.set.reset();
        mockDiagnosticCollection.delete.reset();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('updateProblems', () => {
        it('should calculate correct range based on leading whitespace', () => {
            const mockScanResult: CxAsca = {
                scanDetails: [
                    {
                        line: 1,
                        problematicLine: '  const unsafeCode = eval("2+2");',  // 2 spaces
                        ruleName: 'Test Rule',
                        remediationAdvise: 'Test Advice',
                        severity: 'LOW'
                    },
                    {
                        line: 2,
                        problematicLine: '    console.log(secret);',  // 4 spaces
                        ruleName: 'Test Rule 2',
                        remediationAdvise: 'Test Advice 2',
                        severity: 'LOW'
                    }
                ]
            } as CxAsca;
            
            updateProblems(mockScanResult, mockUri);
            
            const diagnostics = mockDiagnosticCollection.set.getCall(0).args[1];
            
            expect(diagnostics[0].range.start.character).to.equal(2);
            expect(diagnostics[0].range.end.character).to.equal(33);
            
            expect(diagnostics[1].range.start.character).to.equal(4);
            expect(diagnostics[1].range.end.character).to.equal(24);
        });
    });
});
