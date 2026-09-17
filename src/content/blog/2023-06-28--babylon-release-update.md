---
title: "Babylon Release Update"
slug: "babylon-release-update"
date: "2023-06-28T00:00:00.000Z"
author: "radix"
categories:
  - "community-ecosystem"
  - "product-roadmap"
  - "tech-blog"
excerpt: "Radix Publishing, acting on the recommendation of RDX Works, has decided to postpone the launch of Babylon.The rescheduled date for the Babylon network upgrade is now set for September 27th, 2023."
seoDescription: null
featured: false
showToc: false
archived: false
draft: false
bodyFormat: "html"
image:
  src: "/assets/64b91add11cb0045be9c777d_649c5da9b8e5e14efe11929f_Babylon-Release-Update.png"
  alt: null
video: null
legacy:
  id: "649c5dfb9276f445a562f9e3"
  createdAt: "2023-06-28T16:21:14.999Z"
  updatedAt: "2023-08-17T14:58:20.137Z"
  publishedAt: "2023-08-17T14:58:59.945Z"
---

<p id="">One of the five core values of RDX Works says “Do the right thing, not the easy thing.”&nbsp; It comes up a lot whenever there is a dilemma between taking an approach that will be <em id="">serviceable</em> or one that is more labor-intensive but unequivocally superior. Especially as on an immutable public ledger, you live with your design choices forever, so it’s critical to get them right.&nbsp;</p><p id="">Then there’s a mid-2020 tweet by the founder of Ethereum that has been often referenced during the long march towards the Babylon Mainnet upgrade:</p><figure id="" class="w-richtext-figure-type-image w-richtext-align-center" data-rt-type="image" data-rt-align="center" data-rt-max-width=""><div id=""><img id="" src="/assets/649c5dca0676a200326a52a3_1kHqi3bKzqEyDsCJigk25T4xprzHbfiYb9GgQA98K6vGUPZ7xE-JrdhKdpGCu-YSAEX8lH1bwqPjFKeSQ3QAhr5WT3NV9VEcERJwo69ziOYf3HpoMCHq3BUqLvF6vTpTLyWq2Nx9xJ0phpCoPrxXeQQ.png" width="auto" height="auto" loading="auto"></div></figure><p id="">During RCnet testing we have been reviewing developer feedback, the application examples produced by the community, and Scrypto code created by the RDX Works team. What stood out was that the Gateway API was failing to address the needs of many dApp developers, and that Scrypto’s approach for setting up authentication was producing situations where even experienced devs were making preventable mistakes.</p><p id="">Babylon is all about making smart contract development <em id="">safe</em> and application behavior <em id="">easy to comprehend</em>. However, even developers who knew exactly how the authentication system worked were sometimes omitting important permissions just by being a little hasty. It became clear that a re-design was necessary, and backing such a change in <em id="">after</em> Babylon went live would be considerably more difficult.</p><p id="">Changes to the authentication configuration affect low-level network state, which the Gateway has to comprehend and adapt to.&nbsp; We realized we were marching towards a release where we’d be coding Gateway changes right up until the end, with no time for downstream consumers (including the Wallet and Dashboard, as well as community devs) to build against a stable target, and then no time to adjust based on feedback.&nbsp; The likely outcome of this would be services that rely on the Gateway (Radix Wallet, new Dashboard, and ecosystem projects) would experience stability issues, creating bad user experiences even if the network itself was running smoothly.</p><p id="">Babylon is the critical springboard and foundation for everything that is to come, and it <em id="">deserves</em> a great 1.0 experience. For a 1.0 experience that everyone can enthusiastically recommend to their friends, family, and colleagues, the delivery schedule needs to change.</p><ul id=""><li id="">The Babylon network upgrade will now occur on or about September 27th, 2023</li><li id="">RCnet v2, including authentication redesign, will be split into two parts</li></ul><ul id=""><li id="">The Node, Radix Engine, and Scrypto will be released on July 6th</li><li id="">An updated Gateway, Wallet, and Dashboard will be released a few weeks after</li></ul><ul id=""><li id="">The public test migration of Stokenet will use the RCnet v2 node, and will occur the week of July 10th</li><li id="">RCnet v3 will mark a stable Gateway for developers to target, and will include additional endpoints requested by the community.&nbsp; It will go live in August, with no exact date yet determined.</li></ul><p id="">Additionally, the RDX Works development team will be setting up some live Q&amp;A sessions with community developers in order to answer detailed questions about specific feature availability.&nbsp; The first session will be on July 11th, at 15:00 UTC.</p><p id="">Updating the release timeline was a difficult decision.&nbsp; It was certainly tempting to just push ahead with a workmanlike first release, and then revisit it with later patches.&nbsp; But that would have started Babylon off with an inferior foundation.&nbsp; It would be forgoing some short-term pain for long-term consequences.&nbsp; It wouldn’t have been <em id="">right</em>, given all that is ahead to achieve.&nbsp; And Radix is playing for all the marbles.</p>
