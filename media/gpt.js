// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
	const vscode = acquireVsCodeApi();
	var question = "";

	let questionElement = document.getElementById('askQuestion');
	if (questionElement) {
		document.getElementById('askQuestion').addEventListener('change', (e) => {
			// @ts-ignore
			question = e.target.value;
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

	var i = 1;
	var currentMessage;
	var currentID;

	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	async function typeWriter() {
		while (i < currentMessage.length) {
			await sleep(10);
			document.getElementById("gpt-" + currentID).innerHTML += currentMessage.charAt(i);
			i++;
		}
	}
	// Display the changes once loaded
	window.addEventListener('message', async event => {
		document.body.scrollIntoView(false);
		const message = event.data;
		let chatContainer;
		switch (message.command) {
			case 'userMessage':
				chatContainer = document.getElementById('chat-container');
				chatContainer.innerHTML = chatContainer.innerHTML + messageUserContainer(message.message);
				break;
			case 'thinking':
				console.log("thinking");
				chatContainer = document.getElementById('chat-container');
				chatContainer.innerHTML = chatContainer.innerHTML + thinkingContainer(message.thinkID, message.icon.external);
				break;
			case 'response':
				console.log("response", message);
				// Hide thinking
				var thinkContainer = document.getElementById(`think-${message.thinkID}`);
				console.log("container", chatContainer);
				thinkContainer.style.display = 'none';
				// Load message response
				chatContainer = document.getElementById('chat-container');
				chatContainer.innerHTML = chatContainer.innerHTML + messageGptContainer(message.message.text, message.icon.external, message.thinkID);
				currentID = message.thinkID;
				currentMessage = message.message.text;
				document.getElementById("gpt-" + currentID).innerHTML += currentMessage.charAt(0);
				await typeWriter();
				i = 1;

				break;
			case 'clearQuestion':
				question = "";
				var questionContainer = document.getElementById(`askQuestion`);
				questionContainer.value = "";
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

	function messageGptContainer(message, icon, id) {
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

	function messageUserContainer(message) {
		let html =
			`
			<div class="card" style="border:none;background:#6769725c;margin-top:0.5em;">
               <div class="card-body">
                  <div class="row">
                    <div class="col">
						<img src="https://mdbcdn.b-cdn.net/img/new/avatars/2.webp" class="rounded-circle" style="width: 2em;height:2em;border-style: solid;border-color: #6769725c;border-width:0.5px"
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

	// const parentDiv = document.getElementById('chat-container');
	// window.onload = function () {

	// };
	// const observer = new MutationObserver(function (mutationsList) {
	// 	for (let mutation of mutationsList) {
	// 		console.log("dentro1");
	// 		if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
	// 			// Call your custom function here when a new <div> is added
	// 			// this function is the reverse version of escapeHTML found at 
	// 			// https://github.com/evilstreak/markdown-js/blob/master/src/render_tree.js
	// 			function unescapeHTML(text) {
	// 				return text.replace(/&amp;/g, "&")
	// 					.replace(/&lt;/g, "<")
	// 					.replace(/&gt;/g, ">")
	// 					.replace(/&quot;/g, "\"")
	// 					.replace(/&#39;/g, "'");
	// 			}
	// 			// based on https://gist.github.com/paulirish/1343518
	// 			(function () {
	// 				[].forEach.call(document.querySelectorAll('main_div'), function fn(elem) {
	// 					console.log("dentro12");
	// 					elem.innerHTML = (new Showdown.converter()).makeHtml(unescapeHTML(elem.innerHTML));
	// 				});
	// 			}());
	// 		}
	// 	}
	// });
	// observer.observe(parentDiv, { childList: true });


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