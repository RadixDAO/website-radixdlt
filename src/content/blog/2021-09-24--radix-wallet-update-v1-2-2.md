---
title: "Radix Wallet Update: v1.2.2"
slug: "radix-wallet-update-v1-2-2"
date: "2021-09-24T00:00:00.000Z"
author: "rdx-works"
categories:
  - "product-roadmap"
excerpt: "As always, you can download it at wallet.radixdlt.com, and if you're currently on v1.1.1, you may have noticed an in-app update feature which will work as well."
seoDescription: null
featured: false
showToc: false
archived: false
draft: false
bodyFormat: "html"
image:
  src: "/assets/629dc4b573d101a66c2f4d45_614e0738fa6e774602ae36a3_blog-bg.png"
  alt: null
video: null
legacy:
  id: "649aa8a9681ec6168a57dd7b"
  createdAt: "2021-09-24T17:14:23.823Z"
  updatedAt: "2023-07-20T11:30:50.626Z"
  publishedAt: "2023-07-24T09:21:21.692Z"
---

<p id="">As posted on our new<a id="" href="https://status.radixdlt.com/"> Operations Status page</a>, the big item in this wallet is resolving an issue that has been unfortunately causing the wallet to trigger our DDoS protection and block many users from using the wallet. This means that we ask that you <strong id="">please update to v1.2.2 right away</strong>. As always, you can download it at<a id="" href="http://wallet.radixdlt.com"> wallet.radixdlt.com</a>, and if you're currently on v1.1.1, you may have noticed an in-app update feature which will work as well. </p><p id="">Here is Matthew Hine, Head of Product at Radix DLT with some more info. Alternative, keep reading below:</p><figure id="" class="w-richtext-figure-type-video w-richtext-align-fullwidth" style="padding-bottom:56.206088992974244%" data-rt-type="video" data-rt-align="fullwidth" data-rt-max-width="" data-rt-max-height="56.206088992974244%" data-rt-dimensions="854:480" data-page-url="https://youtu.be/nwLjJvDfMeg"><div id=""><iframe src="https://www.youtube.com/embed/nwLjJvDfMeg" scrolling="no" frameborder="0" allowfullscreen="true"></iframe></div></figure><p id="">‍<br></p><p id="">But wait, there's more! v1.2.2 also contains a big much-requested feature: the <strong id="">ability to connect to different archive nodes and networks</strong>. You can now choose to connect to either the Radix Mainnet – or Stokenet if you want to do some testing and experimentation. You can do this in the in-app preferences by selecting the Mainnet or Stokenet archive node endpoints offered by Radix.<br></p><p id="">Importantly, you can also add new archive node addresses manually. This means that members of the community who wish to run their own archive nodes – either for their own use or to offer to the community – can now have easy wallet connectivity. The wallet will automatically detect if the node is connecting to Mainnet or Stokenet. We hope this will help with developer and node-runner testing, as well as providing an avenue for community-driven expansion of archive node options for wallet users.<br></p><p id=""><strong id="">Note: Please be cautious when choosing an archive node!</strong> It is important that you fully trust the archive node that you select! Never connect to an archive node without knowing who is running it and that it is not malicious. While the Radix Desktop Wallet itself provides some protections and always asks the user to review transactions before signing, a malicious node could attempt to alter transactions you request while connected to it, and potentially take your tokens as a result if you aren't careful.<br></p><p id="">Here's a little more breakdown.<br></p><p id=""><strong id="">Features:</strong></p><ul id=""><li id="">In-app selection of the archive node you want the wallet to connect to. Includes default Radix Mainnet and Stokenet nodes, and the ability to manually specify new nodes by DNS address (ie. URL). For now, your address will need to be https with a proper cert (not self-signed). We'll soon make the couple of tweaks under the hood to make node addresses more flexible, like IP addresses.</li><li id="">Third party tokens now show their names, descriptions, and RRIs on the Balances page, and include a link out to the Explorer's new token RRI info page. You can now be sure that you have the <em id="">true</em> Doge3 and not a mere imitator.</li></ul><p id="">‍</p><p id=""><strong id="">Bug fixes:</strong></p><ul id=""><li id="">Polling of ledger data from various wallet pages has been made vastly more intelligent and eliminated rapid polling under poor connectivity conditions</li><li id="">Launching the wallet when it cannot connect to its default archive node endpoint no longer blue-screens or appears as an incorrect password, but instead takes you to the network selection screen where you may select a different node, retry, or link to our Operations Status page</li><li id="">"I forgot my password" option to clear your wallet file and recover from seed phrase or create a new wallet works again (sorry about that)</li><li id="">Improved reliability of balance display when switching accounts</li><li id="">Various UI improvements and small bug fixes</li></ul><p id="">‍</p>
