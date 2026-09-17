---
title: "Bottlenose Protocol Update Candidate Released"
slug: "bottlenose-protocol-update-candidate-released"
date: "2024-05-16T00:00:00.000Z"
author: null
categories:
  - "product-roadmap"
  - "crypto-defi"
excerpt: null
seoDescription: null
featured: false
showToc: false
archived: false
draft: false
bodyFormat: "html"
image:
  src: "/assets/6645de8838572d4865bd65c2_Bottlenose-Node-Released-2.png"
  alt: null
video: null
legacy:
  id: "6645d20bf37d16c16f20cb49"
  createdAt: "2024-05-16T09:29:47.154Z"
  updatedAt: "2024-05-30T14:17:26.536Z"
  publishedAt: "2024-05-30T14:17:26.536Z"
---

<p id="">Exciting times are ahead for the Radix Network with the proposed Bottlenose protocol update, just released to the node runner community and targeted to be enacted on or around Monday, June 3rd.</p><p id="">Let's examine what's new and explain one of the key features—the <a id="" href="https://docs.radixdlt.com/docs/locker">AccountLocker blueprint</a>—in simple terms.</p><h2 id=""><strong id="">Key Features of the Bottlenose Protocol Update</strong></h2><ul id=""><li id=""><strong id="">AccountLocker Native Blueprint:</strong> A new blueprint designed to simplify handling account deposits.</li><li id=""><strong id="">API Enhancements: </strong>New API for reading the component owner role from Scrypto.</li><li id=""><strong id="">Protocol Parameters Exposure:</strong> New substates to reveal current protocol-related parameters.<strong id="">‍</strong></li><li id=""><strong id="">AccessController Improvements:</strong> Addition of a recovery fee vault, eliminating the need for third-party fee locking during recovery.<strong id="">‍</strong></li><li id=""><strong id="">Account and TransactionProcessor Enhancements:</strong> Various improvements to native blueprints.<strong id="">‍</strong></li><li id=""><strong id="">Radix Engine Enhancements:</strong> Various implementation improvements.<br>‍</li></ul><h2 id=""><strong id="">Understanding Lockers</strong></h2><p id="">One of the standout features of the Bottlenose update is the introduction of the AccountLocker blueprint. But what exactly is a Locker, and how does it benefit users?&nbsp;</p><p id="">Let’s break it down in simple terms.</p><h2 id=""><strong id="">What is an AccountLocker?</strong></h2><p id="">Think of it like an Amazon delivery locker.&nbsp; Any dApp can create an AccountLocker and place things in it for you to pick up later (if you want to).</p><h2 id=""><strong id="">Why Do We Need AccountLockers?</strong></h2><p id=""><strong id="">No Delivery Issues:</strong> Accounts on Radix can be configured to refuse unfamiliar tokens, which stops undesired deposits (like airdrops) from being accepted. However, sometimes, an application has a need to ensure delivery, regardless of account settings. For example, think of a cross-chain bridging application - the bridging operation needs a guaranteed way to get those tokens to the recipient on the Radix side and won’t be willing to hold on to them on their behalf.&nbsp; So, it creates an AccountLocker and routes all deliveries through it.&nbsp; If the receiving account is configured to accept deposits, then tokens get deposited directly.&nbsp; If not, then they sit in the Locker, waiting for the account’s owner to come claim them.</p><p id=""><strong id="">Easy Bookkeeping for dApps: </strong>Applications using AccountLockers don’t have to keep track of who they owe what; they can easily get tokens “off the books” and know that they will be available for their intended recipients.</p><p id=""><strong id="">No Spam for Account Owners</strong>: Remember, AccountLockers are associated with applications, not accounts! As an account owner, you don’t get spammed with knowledge of all the deposits that are available for you to claim.&nbsp; Applications that you choose to connect to can let you know that they have a deposit waiting for you in their associated Locker, and you can choose to claim them or let them sit.</p><h2 id=""><strong id="">Enhanced Airdrop Management</strong></h2><p id="">On Radix, accounts can block unwanted airdrops, giving users greater control. However, this doesn’t mean airdrops are dead on Radix. Here’s how Lockers make airdrops easy while respecting user preferences:</p><p id="">Each dApp can create its own Locker. If a dApp wants to conduct an airdrop, any tokens that couldn’t be directly deposited go into the Locker, keyed to each intended recipient.</p><p id="">Only the account owner can claim their airdrop from the dApp's Locker. Developers can create a web frontend to let users claim their airdrops – just inform users to check that webpage.&nbsp;</p><p id="">You can still do your airdrop, and if it interests people who have airdrops disabled on their accounts, they can come and get it later.</p><h2 id=""><strong id="">Future Enhancements: Radix Wallet Support</strong></h2><p id="">In the future, the Radix Wallet will automatically discover any items waiting for you from dApps to which you have chosen to connect.&nbsp; And, of course, you’ll be able to opt out of continuing to pay attention to a particular dApp if you decide you’re not interested.</p><p id="">If you’d like a more detailed understanding of AccountLocker, check out the <a id="" href="https://docs.radixdlt.com/docs/locker">AccountLocker technical documentation</a>.&nbsp;</p>
