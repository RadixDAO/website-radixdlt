---
title: "Understanding Centralized Systems"
slug: "understanding-centralized-systems"
date: "2018-09-13T00:00:00.000Z"
author: "rdx-works"
categories: []
excerpt: "This article discusses how applications have traditionally been built and the common application design pattern used in current centralized systems."
seoDescription: null
featured: false
showToc: false
archived: false
draft: false
bodyFormat: "html"
image:
  src: "/assets/629dc4bd8b5e123b7e667086_6088593d2095b803acc46b59_centralized-systems.jpeg"
  alt: null
video: null
legacy:
  id: "649aa8a9681ec6168a57dcac"
  createdAt: "2021-04-27T08:16:24.577Z"
  updatedAt: "2023-07-20T11:31:20.496Z"
  publishedAt: "2023-07-24T09:21:21.692Z"
---

<p id="">On our previous post: <a id="" href="https://www.radixdlt.com/post/our-path-to-decentralization">Our Path To Decentralization</a>, we took a brief look at the evolution that applications have had since the invention of Distributed Ledger Technology.</p><p id="">Although throughout this series we will mainly be exploring the concept of decentralized applications - or dapps, it is important to first understand how applications have traditionally been built. In order to accomplish this, we will take a look at two common application design patterns:</p><h2 id="">Three Tier Architecture</h2><figure id="" class="w-richtext-figure-type-image w-richtext-align-floatright" data-rt-type="image" data-rt-align="floatright"><div id=""><img id="" src="/assets/6087c8585deb9f1a7f9a1744_5ba3828efafb149836dd72fb_Picture1.png" width="auto" height="auto" loading="auto"></div></figure><p id="">One of the most common patterns when designing an application is the Three Tier Architecture.</p><p id="">In this pattern, developers define three big conceptual parts of any system:</p><ul id=""> 	<li id="">The Presentation Layer</li> 	<li id="">The Logic Layer</li> 	<li id="">The Data Layer</li></ul><p id="">Each of the layers has a specific set of responsibilities and is decoupled from the other two, which allows for faster development and reduced maintenance costs because you can easily work on each of the layers in parallel.</p><p id="">Although this architecture may seem trivial for some readers, it’s very important to have a basic understanding of it in order to follow this blog series properly.</p><h2 id="">Client - Server Architecture</h2><p id="">Another common pattern, that will help us understand how centralized applications are designed is the <strong id="">Client - Server architecture.</strong>‍</p><figure id="" class="w-richtext-figure-type-image w-richtext-align-center" data-rt-type="image" data-rt-align="center"><div id=""><img id="" src="/assets/6087c8583673cace1b2704bb_5ba382beff7d47cfa4701199_Picture12.png" width="auto" height="auto" loading="auto"></div></figure><p id=""><strong id="">Client</strong>: Part of the application that interactsdirectly with the user, typically on a computer or a smartphone. The clientusually only performs lightweight calculations and relies on the server fordata processing.</p><p id="">‍<strong id="">Server</strong>: Part of the application that focuses on datamanagement and logic execution. The server is optimized for receiving requestsfrom the client, processing them, and storing and receiving information from adatabase</p><p id="">Because all data and logic resides in a protected environment, the server-client architecture allows companies to maintain full control over their Digital and Intellectual Property as well as optimize their hardware infrastructure for their specific usage.</p><p id="">On the other hand, this approach requires the users to completely trust the service provider since the users have no way to validate what's happening on the server and has multiple security flaws, such as the issue of having all the user data on a single honeypot.</p><p id="">In the following posts we will take a deeper look the Radix approach to building dApps, and why it is much more powerful than the other options out there.</p><h2 id="">Decentralized Applications</h2><p id="">Thanks to the invention of Distributed Ledger Technology however, we are now able to build systems that don’t have a single point of failure. Although it’s sometimes hard to ensure that that is the case (ej, DNS systems), we can now benefit from this innovation, which will allow as to build cheaper, safer and more transparent applications.</p><p id="">However, not all DAPPs are equal, and their properties can change heavily depending on their architecture. In the next articles we will compare three different application architectures enabled by distributed application platforms.</p>
