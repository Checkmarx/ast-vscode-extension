// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
const vscode = acquireVsCodeApi();
(function () {
	const copySvg = '<svg style="width:12px" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"> <g clip-path="url(#clip0_179_1272)"> <path d="M2.87961 1.60003C2.17268 1.60003 1.59961 2.1731 1.59961 2.88003V9.28003C1.59961 9.63349 1.88615 9.92002 2.23961 9.92002C2.59307 9.92002 2.87961 9.63349 2.87961 9.28003V2.88003L9.27961 2.88003C9.63307 2.88003 9.91961 2.59349 9.91961 2.24003C9.91961 1.88656 9.63307 1.60003 9.27961 1.60003H2.87961Z" fill="#3794FF"/> <path fill-rule="evenodd" clip-rule="evenodd" d="M4.15961 5.44003C4.15961 4.7331 4.73268 4.16003 5.43961 4.16003H13.1196C13.8265 4.16003 14.3996 4.7331 14.3996 5.44003V13.12C14.3996 13.8269 13.8265 14.4 13.1196 14.4H5.43961C4.73268 14.4 4.15961 13.8269 4.15961 13.12V5.44003ZM5.43961 5.44003H13.1196V13.12H5.43961V5.44003Z" fill="#3794FF"/> </g> <defs> <clipPath id="clip0_179_1272"> <rect width="12.8" height="12.8" fill="white" transform="translate(1.59961 1.6)"/> </clipPath> </defs> </svg>';
	var question = "";
	var currentMessage;
	var currentID;

	marked.setOptions({
		renderer: new marked.Renderer(),
		highlight: function (code, _lang) {
			return hljs.highlightAuto(code).value;
		},
		langPrefix: 'hljs language-',
		pedantic: false,
		gfm: true,
		breaks: false,
		sanitize: false,
		smartypants: false,
		xhtml: false
	});

	document.getElementById('askQuestion').addEventListener('change', (e) => {
		// @ts-ignore
		question = e.target.value;
	});
	document.getElementById('askQuestion').addEventListener('keypress', (e) => {
		var userQuestionDis = document.getElementById(`userQuestion`);
		// case the user presses enter then we send the message but only if it is not waiting for a response from gpt
		if (e.key === 'Enter' && !e.altKey && userQuestionDis.style.cursor !== 'not-allowed') {
			vscode.postMessage({
				command: 'userQuestion',
				question: e.target.value
			});
		}
		// case the user presses alt enter then we add a new line 
		if (e.key === 'Enter' && e.altKey) {
			e.target.value += "\n";
		}
	});

	document.querySelectorAll("[id^='userQuestion']").forEach(element => {
		element.addEventListener('click', () => {
			vscode.postMessage({
				command: 'userQuestion',
				question: question
			});
		});
	});

	// Handle the click on the explainFile card
	document.querySelectorAll("[id^='explainFile']").forEach(element => {
		element.addEventListener('click', (e) => {
			document.body.scrollIntoView(false);
			// @ts-ignore
			vscode.postMessage({
				command: 'explainFile',
			});
		});
	});

	document.querySelectorAll("[id^='explainResults']").forEach(element => {
		element.addEventListener('click', (e) => {
			document.body.scrollIntoView(false);
			// @ts-ignore
			vscode.postMessage({
				command: 'explainResults',
			});
		});
	});

	document.querySelectorAll("[id^='explainRemediations']").forEach(element => {
		element.addEventListener('click', (e) => {
			document.body.scrollIntoView(false);
			// @ts-ignore
			vscode.postMessage({
				command: 'explainRemediations',
			});
		});
	});

	async function typeWriter() {
		const inCodeBlock = currentMessage.includes('```') && currentMessage.split('```').length % 2 === 0;
		const markedContent = new DOMParser().parseFromString(marked.parse(currentMessage + (inCodeBlock ? '\n```' : '')), 'text/html');
		const textMarkdown = markedContent.documentElement.innerHTML;
		document.getElementById("gpt-" + currentID).innerHTML += textMarkdown;
		const chatContainer = document.getElementById('chat-container');
		const pres = chatContainer.querySelectorAll('pre');
		pres.forEach((pre) => {
			if (pre.previousElementSibling && pre.previousElementSibling.className !== 'codeblockHeader') {
				pre.insertAdjacentHTML('beforebegin',
					`
			<div class="codeblockHeader">
				<div style="width:100%">
					<button class="copy-button" title="Copy code">${copySvg}</button>
				</div>
			</div>`
				);
			}
		});
		addCopyButtons(chatContainer);
	}

	function addCopyButtons(chatContainer) {
		const copyButtonElements = chatContainer.querySelectorAll('.copy-button');
		copyButtonElements.forEach((copyButtonElement) => {
			copyButtonElement.addEventListener('click', () => {
				const codeElement = copyButtonElement.parentElement.parentElement.nextElementSibling;
				const code = codeElement.innerText;
				navigator.clipboard.writeText(code);
			});
		});
	}

	// Display the changes once loaded
	window.addEventListener('message', async event => {
		document.body.scrollIntoView(false);
		const message = event.data;
		let chatContainer;
		switch (message.command) {
			case 'userMessage':
				chatContainer = document.getElementById('chat-container');
				chatContainer.innerHTML = chatContainer.innerHTML + messageUserContainer(message.message, "https://" + message.icon.authority + message.icon.path);
				break;
			case 'thinking':
				chatContainer = document.getElementById('chat-container');
				chatContainer.innerHTML = chatContainer.innerHTML + thinkingContainer(message.thinkID, message.icon.external);
				break;
			case 'response':
				// Hide thinking
				var thinkContainer = document.getElementById(`think-${message.thinkID}`);
				thinkContainer.style.display = 'none';
				// Load message response
				chatContainer = document.getElementById('chat-container');
				chatContainer.innerHTML = chatContainer.innerHTML + messageGptContainer(message.icon.external, message.thinkID);
				currentID = message.thinkID;
				currentMessage = message.message.message;
				// document.getElementById("gpt-" + currentID).innerHTML += currentMessage.charAt(0);
				await typeWriter();
				i = 1;

				break;
			case 'clearQuestion':
				question = "";
				var questionContainer = document.getElementById(`askQuestion`);
				questionContainer.value = "";
				break;
			case 'enable':
				var cardsContainer = document.getElementById(`cards-container`);
				cardsContainer.style.cursor = 'auto';

				var explainFile = document.getElementById(`explainFile`);
				explainFile.style.cursor = 'pointer';
				explainFile.style.pointerEvents = 'auto';

				var explainResults = document.getElementById(`explainResults`);
				explainResults.style.cursor = 'pointer';
				explainResults.style.pointerEvents = 'auto';

				var explainRemediations = document.getElementById(`explainRemediations`);
				explainRemediations.style.cursor = 'pointer';
				explainRemediations.style.pointerEvents = 'auto';

				var askQuestion = document.getElementById(`askQuestion`);
				askQuestion.style.cursor = 'pointer';
				askQuestion.style.pointerEvents = 'auto';

				var userQuestion = document.getElementById(`userQuestion`);
				userQuestion.style.cursor = 'pointer';
				break;
			case 'disable':

				var cardsContainerDis = document.getElementById(`cards-container`);
				cardsContainerDis.style.cursor = 'not-allowed';

				var explainFileDis = document.getElementById(`explainFile`);
				explainFileDis.style.pointerEvents = 'none';

				var explainResultsDis = document.getElementById(`explainResults`);
				explainResultsDis.style.pointerEvents = 'none';

				var explainRemediationsDis = document.getElementById(`explainRemediations`);
				explainRemediationsDis.style.pointerEvents = 'none';

				var userQuestionDis = document.getElementById(`userQuestion`);
				userQuestionDis.style.cursor = 'not-allowed';
				break;
		}
		document.body.scrollIntoView(false);
		const paragraphs = document.querySelectorAll('.animated-text');
		paragraphs.forEach((paragraph) => {
			paragraph.addEventListener('animationend', () => {
				paragraph.classList.remove('animated-text');
			});
		});
	});

	function thinkingContainer(thinkID, icon) {
		let html =
			`
			<div id="think-${thinkID}" class="card" style="border:none;background:transparent;margin-bottom:1em;">
               <div class="card-body">
                  <div class="row">
                     <div class="col">
						<img src="${icon}" class="avatar"
						alt="Avatar" />
						AI Guided Remediation
					</div>
                  </div>
                  <div class="row" style="margin-top:0.8em">
                    <div class="col">
					 	<p class="animated-text-thinking">Thinking ...</p>
         		 	</div>
                 </div>
               </div>
            </div>`;
		return html;
	}

	function messageGptContainer(icon, id) {
		let html =
			`
			<div class="card" style="border:none;background:transparent;margin-bottom:1em;">
               <div class="card-body">
                  <div class="row">
                     <div class="col">
						<img src="${icon}" class="avatar"
						alt="Avatar" />
			   			AI Guided Remediation
         			</div>
                  </div>
                  <div class="row" style="margin-top:0.8em">
                     <div class="col">
						<p class="animated-text" id="gpt-${id}">
						</p>
         			</div>
                  </div>
               </div>
            </div>`;
		return html;
	}

	function messageUserContainer(message, icon) {
		let html =
			`
			<div class="card" style="border:none;background:#6769725c;margin-top:0.5em;">
               <div class="card-body">
                  <div class="row">
                    <div class="col">
						<img src="${icon}" class="avatar"
						alt="Avatar" />
						${message.user}
         			</div>
                  </div>
                  <div class="row" style="margin-top:0.8em">
                     <div class="col">
					 	<p class="animated-text">
							${message.message}
						</p>
         			 </div>
                  </div>
               </div>
            </div>`;
		return html;
	}

	document.querySelectorAll("[id^='gpt-settings']").forEach(element => {
		element.addEventListener('click', () => {
			vscode.postMessage({
				command: 'openSettings',
			});
		});
	});
	// Go back to the top button
	let mybutton = document.getElementById("btn-back-to-top");

	// When the user scrolls down 20px from the top, the button appears
	window.onscroll = function () {
		scrollFunction();
	};

	function scrollFunction() {
		if (
			document.body.scrollTop > 20 ||
			document.documentElement.scrollTop > 20
		) {
			mybutton.style.display = "block";
		} else {
			mybutton.style.display = "none";
		}
	}
	// When the user clicks on the button, scroll back to the top
	mybutton.addEventListener("click", backToTop);

	function backToTop() {
		window.scrollTo({
			top: 0,
			behavior: 'smooth'
		});
	}
}());