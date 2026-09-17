---
title: "Protocol Level Decentralized Applications"
slug: "protocol-level-decentralized-applications"
date: "2018-09-20T00:00:00.000Z"
author: "rdx-works"
categories: []
excerpt: "In this post we summarize a new way of developing decentralized applications without smart-contracts using protocol level constraints."
seoDescription: "A primer on constraints and way decentralized applications can work on a public, decentralized network"
featured: false
showToc: false
archived: false
draft: false
bodyFormat: "html"
image:
  src: "/assets/629dc4c36a8d87b25240a66c_60885a9ef734976bdc998613_decentralized-applications.jpeg"
  alt: null
video: null
legacy:
  id: "649aa8a9681ec6168a57dcad"
  createdAt: "2021-04-27T08:16:25.402Z"
  updatedAt: "2023-07-20T11:31:15.439Z"
  publishedAt: "2023-07-24T09:21:21.692Z"
---

<h2 id="">“Creativity comes from constraint” - Biz Stone</h2><p id="">Because of the properties that DLT offers, any distributed ledger has the capability to heavily enforce certain constraints. No system administrator, hacker or government can break free of the constraints that are defined by the protocol, and this is a property that no centralized system can offer.</p><p id="">On Bitcoin, we can easily see that the following constraints are enforced by the protocol:</p><ul id=""> 	<li id="">There will never be more than 21M BTC.</li> 	<li id="">Entries on the ledger are immutable.</li> 	<li id="">Only the owner(s) of a private key can sign transactions for a certain public key.</li> 	<li id="">Every transaction requires a fee.</li> 	<li id="">One can’t spend the same bitcoins twice.</li> 	<li id="">One can’t send more bitcoins than owned.</li> 	<li id="">An N of M Multi-signature account can only transact if at least N of the co-signatories sign the transaction.</li></ul><p id="">Some of these constraints seem pretty obvious at the moment. However, it is important to understand that on a traditional database it is extremely expensive to enforce any of them anywhere close to 100%, which can never be reached.</p><p id="">Any DLT protocol can define a set of rules that will be enforced to all and any participants. This rules can then be used to build applications at a fraction of their traditional development cost.</p><p id="">On the other side, in order to pay for the data processing, every transaction has a cost, its fee, based on the network’s load and for most implementations there is a big limitation on the amount of transactions per second that it can process.</p><p id="">Radix, however, is the first DLT implementation that can scale linearly, increasing the throughput as the amount of nodes increase, and that uses minimal node resources, ensuring maximum decentralization.</p><h2 id="">Relying on constraints</h2><p id="">When building an application, most developers are used to relying on frameworks and libraries that help them work faster. These tools saves them huge amounts of development time by offering plug and play code that provide recurring features such as specific API calls, common calculations and user interface elements such as buttons or icons.</p><p id="">Similarly, DLT can save a huge percentage of development time thanks to the use of protocol level constraints. Since the constraints are built in and enforced by the protocol, the developers can effectively rely on them to build their own systems.</p><figure id="" class="w-richtext-figure-type-image w-richtext-align-floatright" data-rt-type="image" data-rt-align="floatright"><div id=""><img id="" src="/assets/6087c859809509d662a0c33d_5ba380fb65e1d076f94c2702_3.-dApp-Series-Protocol-level-DAPPs.jpeg" width="auto" height="auto" loading="auto"></div></figure><p id="">Let’s look at a simple example: Imagine a certification process that requires 3 out of 5 sensors to agree on the fact that a product has passed its corresponding tests. Typically this would require a server that asks each one of the sensors for their ‘opinion’ as well as all the necessary security procedures to ensure that their decision has not been tampered with.</p><p id="">Instead, by using a multi-signature account, the ledger takes care of most of the code. The developer just needs to setup a different private key for each device and connect them to a multi-signature account.</p>
