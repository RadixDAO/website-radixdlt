---
title: "Archive Nodes Shutting Down on Feb. 22nd"
slug: "archive-nodes-shutting-down-on-feb-18th"
date: "2022-02-02T00:00:00.000Z"
author: "radix"
categories:
  - "product-roadmap"
  - "community-ecosystem"
excerpt: null
seoDescription: null
featured: false
showToc: false
archived: false
draft: false
bodyFormat: "html"
image:
  src: "/assets/629dc4a27290ef4456d5a3ea_61faa9147b151e80a4a89c8e_Archive-nodes-turning-off.png"
  alt: null
video: null
legacy:
  id: "649aa8a9681ec6168a57ddbb"
  createdAt: "2022-02-02T15:54:21.818Z"
  updatedAt: "2023-07-20T11:30:52.286Z"
  publishedAt: "2023-07-24T09:21:21.692Z"
---

<h4 id=""><strong id="">Update 18/02/2022: The Archive Nodes will now be shutting down Tuesday 22nd February, 2022. <br>‍</strong></h4><p id=""><strong id="">TLDR; If you haven’t updated to v1.3 (or above) of the Radix Desktop Wallet by Feb 22nd then it will stop working until you do get the chance to update.</strong></p><p id=""><strong id="">Download the latest wallet here: </strong><a id="" href="https://wallet.radixdlt.com"><strong id="">https://wallet.radixdlt.com&nbsp;</strong></a></p><p id="">The Archive Nodes that the Radix Desktop Wallet has connected to until v1.3 are being shut down on Feb 22nd. As a Wallet user, all this means for you is that if you haven’t already upgraded to v1.3 by then, you’ll have to do so to keep using the Radix Wallet. Otherwise, carry on and things should run even more quickly and smoothly!</p><p id="">If you’d like to know more, or are a developer using the Radix API, read on:</p><h2 id=""><strong id="">The Archive → Gateway Transition</strong></h2><p id="">As you probably are aware, a substantial update to the Radix APIs that serve the Radix Desktop Wallet, Explorer, and various third-party dashboards and testing was released recently. This update obsoleted the old Archive Node structure in favor of a new Gateway that is much more scalable, easier to operate and maintain, and easy to update independent from the core Node software.</p><p id="">The release of Radix Desktop Wallet v1.3 marks the transition of the wallet from using Archive Nodes (run by Radix Tokens (Jersey) Ltd. as a service to the Radix community) to the new Gateway Service (also operated by RTJL). This transition has gone well, with the new service responding much more quickly to queries at load. Older versions of the wallet are still able to connect to the Archive Nodes that are currently still running, but we’re pleased to see users upgrading rapidly.</p><p id="">As a result, preparations are being made to cease operation of Archive Nodes to significantly reduce the operational support overhead of running two parallel systems of infrastructure. To make this as smooth as possible, this announcement is being made regarding the shutdown plan well ahead of time:</p><p id=""><strong id="">On Feb. 22nd, RTJL will shut down Archive Nodes on Stokenet (the main Radix test network).</strong> This will have no impact on users of Mainnet.</p><p id=""><strong id="">On Feb. 22nd, RTJL will shut down Archive Nodes on Mainnet.</strong> At this point Wallet versions below v1.3 will no longer be able to connect. <em id="">There is no risk to accounts or tokens, and no urgency for anyone to upgrade before this date.</em> But after this date you will need to upgrade to a v1.3+ Wallet version to continue use.</p><p id="">For community members who have dashboards, wallets, or other apps that connect to our API endpoint at mainnet.radixdlt.com, you currently by default still see Archive Node API but you should transition your usage to the Gateway API right away. Or you may consider running your own Gateway to have full control of your service to end users. Posts were made to highlight the need for this change in our Discord #node-runners channel back in December, and most have already done so. You can <a id="" href="https://docs.radixdlt.com/main/apis/gateway-api.html">learn more about using the Gateway service on our documentation site</a>, or <a id="" href="https://docs.radixdlt.com/main/node-and-gateway/software-introduction.html">learn how to run your own Node and Gateway</a>.</p><p id="">For community members who have been offering your own Archive Node – you will need to update to running a Gateway in order to continue offering an option for users of the Wallet.</p><p id="">Other than this, we anticipate a smooth shutdown and full transition to a bright future of Gateway service. Thanks for your patience and input during this changeover period!</p><p id="">‍<br></p><h4 id=""><strong id="">Update 18/02/2022: The Archive Nodes will now be shutting down Tuesday 22nd, 2022. </strong></h4>
