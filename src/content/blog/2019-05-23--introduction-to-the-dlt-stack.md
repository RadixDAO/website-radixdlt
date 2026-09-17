---
title: "Introduction to the DLT Stack"
slug: "introduction-to-the-dlt-stack"
date: "2019-05-23T00:00:00.000Z"
author: "rdx-works"
categories: []
excerpt: null
seoDescription: "A short explainer on technological stacks used in distributed ledger networks, such as blockchain and DAGs"
featured: false
showToc: false
archived: false
draft: false
bodyFormat: "html"
image:
  src: "/assets/629dc4bd7290ef486bd5a44a_609d72ae1bde80416f3b58a5_stackstack.png"
  alt: null
video: null
legacy:
  id: "649aa8a9681ec6168a57dd17"
  createdAt: "2021-04-27T08:17:00.170Z"
  updatedAt: "2023-07-20T11:31:13.370Z"
  publishedAt: "2023-07-24T09:21:21.692Z"
---

<p id="">"Controlling complexity is the essence of computer programming."-Brian KernighanCreating correctly working software is hard. Creating correctly working distributed, decentralized, permissionless, scalable software...well, that’s a whole other beast of a problem.</p><p id="">To make it easier to think and communicate about complex software systems, software engineers use this concept called a “stack”.</p><p id=""> Simply put, it is just a way of splitting up different parts of a system.There are well-known software stacks like the OSI model for networking or the (old school) LAMP stack for web services. But as far as stacks for DLTs/Blockchains there doesn’t seem to be a good model as of yet which can make it difficult to talk about and compare different DLT solutions.So to get right to the point, here’s our DLT stack proposal:</p><figure id="" class="w-richtext-figure-type-image w-richtext-align-center" data-rt-type="image" data-rt-align="center"><div id=""><img id="" alt="" src="/assets/6087c87b3673caacf52704ee_Introduction-to-DLT-Stacks-2nd.png" width="auto" height="auto" loading="auto"></div></figure><p id="">It’s not fully comprehensive nor does it describe the full complexity of what goes on in a DLT. But it does give an easy go-to language upon which we can talk about certain aspects of different DLTs as well as point to a specific part with ease. Let’s define each layer now:</p><ul id=""> 	<li id=""><strong id="">Application Layer: This layer describes an application with high-level business logic which can be as simple as a wallet or more complex like an “on-chain” smart contract.</strong></li> 	<li id=""><strong id="">Platform Layer:</strong> This layer describes the APIs and interfaces which serves as the gateway for applications to interact with the “machine”.</li> 	<li id=""><strong id="">Machine Layer:</strong> This layer describes the <em id="">Ledger </em>part of DLTs. This is the physical engine and structure which can get updated by outside actors as they add to the ledger. Note that this isn’t literally hardware machine but more of a simulation of one (e.g. Ethereum Virtual Machine).</li> 	<li id=""><strong id="">Consensus Layer: This layer describes the <em id="">Distributed</em> part of DLTs. Because the system is distributed there must be a way to achieve consensus to resolve conflicts. For permissionless blockchains, examples of this would be: PoW, PoS.</strong></li></ul><p id="">Using this notation, here’s a quick example comparison between Radix and Ethereum DLT models:</p><figure id="" class="w-richtext-figure-type-image w-richtext-align-center" data-rt-type="image" data-rt-align="center"><div id=""><img id="" alt="" src="/assets/6087c87bbd15a701d8c6332b_Introduction-to-DLT-Stacks-copy-3rd.png" width="auto" height="auto" loading="auto"></div></figure><p id="">Now that we have a good idea of what each layer means we will be using the following legend at the beginning of each technical article to give a sense of which part of the stack the article will be talking about:</p><figure id="" class="w-richtext-figure-type-image w-richtext-align-center" data-rt-type="image" data-rt-align="center"><div id=""><img id="" alt="" src="/assets/6087c87bbaa248098b0c6a9b_Introduction-to-DLT-Stacks-2.png" width="auto" height="auto" loading="auto"></div></figure><p id="">Luckily, we have the first technical article on the Constraint Machine ready to go! <a id="" href="http://www.radixdlt.com/post/chess-guardians-of-the-galaxy-vol-1/">Check it out here</a>.</p>
