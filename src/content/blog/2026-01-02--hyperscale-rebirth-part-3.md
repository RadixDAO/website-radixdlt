---
title: "Hyperscale Rebirth Part 3"
slug: "hyperscale-rebirth-part-3"
date: "2026-01-02T00:00:00.000Z"
author: "radix"
categories:
  - "radix-labs"
excerpt: "Last weekend, during a test with the private testing group, we reached 381k TPS, and yes, those are swaps, not simple transfers. More than sixty nodes joined my cluster, from data-center grade VPS to home servers, desktops, and even my infamous MacBook Air over WiFi. It ran out of disk space, of course. Some things never change."
seoDescription: null
featured: true
showToc: false
archived: false
draft: false
bodyFormat: "html"
image:
  src: "/assets/6957eacc75e47cb937160e2d_Hyperscale-part-3.png"
  alt: null
video: null
legacy:
  id: "6957eaec8f1d8ef42f424a75"
  createdAt: "2026-01-02T15:57:32.022Z"
  updatedAt: "2026-01-02T15:58:04.252Z"
  publishedAt: "2026-01-22T15:38:53.776Z"
---

<p>It’s been a month since my last update. I always say transparency is easy when everything goes smoothly. What’s harder is sharing the stretches where progress stalls, where you spend weeks trying variations that don’t give the results you want. Those parts are less fun to write and even less fun to read.</p><p>This time I get to share good news. Last weekend, during a test with the private testing group, we reached <strong>381k TPS</strong>, and yes, those are swaps, not simple transfers. More than sixty nodes joined my cluster, from data-center grade VPS to home servers, desktops, and even my infamous MacBook Air over WiFi. It ran out of disk space, of course. Some things never change.</p><h3><strong>Migrating at Hyperscale Speed</strong></h3><p>About four weeks ago, we had to switch hosting providers after pushing well outside the expected usage pattern. Creating and destroying hundreds of VPSs every day isn’t exactly what most hosting companies consider normal. I only run a few serious tests per week, so spinning nodes up and down saves money, but I can’t blame a provider for raising an eyebrow.</p><p>Fortunately, the Radix Foundation runs core infrastructure on AWS. They’re crypto-friendly and support the type of dynamic workloads Hyperscale needs. Within two days, we migrated and continued testing.</p><p>That’s where I hit new roadblocks. Our previous provider offered dedicated resources per node, which meant all four cores and 16GB RAM were truly ours. AWS offers dedicated machines in a different sense, where we still compete with our own workloads on shared physical hardware. When you push everything to its limits, that difference matters.</p><p>The good news is there’s a wealth of information from Dan’s earlier tests and from both the public and private testing groups. With help from community members and reading far too many Telegram messages, I realized Dan wasn’t using dozens of spam nodes like I was. He relied on a few very strong machines to send transactions at scale.</p><h3><strong>Learning to Send Faster</strong></h3><p>One thing you only learn by doing: <strong>sending hundreds of thousands of transactions per second is harder than validating them.</strong> Dan told me this off-hand once, and I didn’t really appreciate it until I was the one bottlenecking my own tests.</p><p>I set up a Hyperscale network with one powerful spam node, 48 cores, 192GB RAM, and quickly discovered the real issue: the spam script I’d been using was single-core. It didn’t matter how much hardware I threw at it; only one core was generating, signing, and sending transactions. That was the choke point.</p><p>So I rewrote the spam script to use all available cores and rebuilt the bootstrap process to generate wallets and pools more efficiently. It took a few days to make everything work together again, but once it clicked, things started to move.</p><h3><strong>Finding a New Ceiling</strong></h3><p>With the updated setup, I booted a fresh network on AWS and began testing. Because the AWS nodes are less powerful, I increased the shard group count and quickly climbed past <strong>250k TPS</strong>, then <strong>350k TPS</strong>.</p><p>Most of the network still runs on hundreds of nodes with specs similar to current Babylon validators, four cores and 16GB RAM. The breakthrough came from combining that setup with two strong machines capable of generating and pushing the required transaction volume.</p><p>It feels like a new path forward, even though Dan had already explored parts of it. Now it’s my turn to push further.</p><h3><strong>Next Target</strong></h3><p>381k TPS was the new height. It won’t be the last.<br><strong>500k is next.</strong></p><p>‍</p>
