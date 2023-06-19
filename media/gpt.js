// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
const vscode = acquireVsCodeApi();
(function () {
	const copySvg = '<svg width="1.5rem" height="1.5rem" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.53 8L14 2.47C13.8595 2.32931 13.6688 2.25018 13.47 2.25H11C10.2707 2.25 9.57118 2.53973 9.05546 3.05546C8.53973 3.57118 8.25 4.27065 8.25 5V6.25H7C6.27065 6.25 5.57118 6.53973 5.05546 7.05546C4.53973 7.57118 4.25 8.27065 4.25 9V19C4.25 19.7293 4.53973 20.4288 5.05546 20.9445C5.57118 21.4603 6.27065 21.75 7 21.75H14C14.7293 21.75 15.4288 21.4603 15.9445 20.9445C16.4603 20.4288 16.75 19.7293 16.75 19V17.75H17C17.7293 17.75 18.4288 17.4603 18.9445 16.9445C19.4603 16.4288 19.75 15.7293 19.75 15V8.5C19.7421 8.3116 19.6636 8.13309 19.53 8ZM14.25 4.81L17.19 7.75H14.25V4.81ZM15.25 19C15.25 19.3315 15.1183 19.6495 14.8839 19.8839C14.6495 20.1183 14.3315 20.25 14 20.25H7C6.66848 20.25 6.35054 20.1183 6.11612 19.8839C5.8817 19.6495 5.75 19.3315 5.75 19V9C5.75 8.66848 5.8817 8.35054 6.11612 8.11612C6.35054 7.8817 6.66848 7.75 7 7.75H8.25V15C8.25 15.7293 8.53973 16.4288 9.05546 16.9445C9.57118 17.4603 10.2707 17.75 11 17.75H15.25V19ZM17 16.25H11C10.6685 16.25 10.3505 16.1183 10.1161 15.8839C9.8817 15.6495 9.75 15.3315 9.75 15V5C9.75 4.66848 9.8817 4.35054 10.1161 4.11612C10.3505 3.8817 10.6685 3.75 11 3.75H12.75V8.5C12.7526 8.69811 12.8324 8.88737 12.9725 9.02747C13.1126 9.16756 13.3019 9.24741 13.5 9.25H18.25V15C18.25 15.3315 18.1183 15.6495 17.8839 15.8839C17.6495 16.1183 17.3315 16.25 17 16.25Z" fill="#808080"/></svg>';
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

	let questionElement = document.getElementById('askQuestion');
	if (questionElement) {
		document.getElementById('askQuestion').addEventListener('change', (e) => {
			// @ts-ignore
			question = e.target.value;
		});
		document.getElementById('askQuestion').addEventListener('keypress', (e) => {
			// case the user presses enter then we send the message
			if (e.key === 'Enter' && !e.altKey) {
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
	}

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
		const markedResponse = new DOMParser().parseFromString(marked.parse(currentMessage + (inCodeBlock ? '\n```' : '')), 'text/html');
		const textWithMarkdown = markedResponse.documentElement.innerHTML;
		document.getElementById("gpt-" + currentID).innerHTML += textWithMarkdown;
		const chatContainer = document.getElementById('chat-container');
		const pres = chatContainer.querySelectorAll('pre');
		pres.forEach((pre) => {
			if (pre.previousElementSibling && pre.previousElementSibling.className !== 'codeblockHeader') {
				pre.insertAdjacentHTML('beforebegin',
					`
			<div class="codeblockHeader">
				<div>
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
						<img src="${icon}" class="rounded-circle" style="width: 2em;height:2emborder-style: solid;border-color: #6769725c;border-width:0.5px"
						alt="Avatar" />
						Ask KICS
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
						<img src="${icon}" class="rounded-circle" style="width: 2em;height:2emborder-style: solid;border-color: #6769725c;border-width:0.5px"
						alt="Avatar" />
			   			Ask KICS
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
						<img src="${icon}" class="rounded-circle" style="width: 2em;height:2em;border-style: solid;border-color: #6769725c;border-width:0.5px"
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