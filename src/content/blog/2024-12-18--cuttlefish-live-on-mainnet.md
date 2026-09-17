---
title: "Cuttlefish Live on Mainnet"
slug: "cuttlefish-live-on-mainnet"
date: "2024-12-18T00:00:00.000Z"
author: null
categories:
  - "product-roadmap"
excerpt: "The “Cuttlefish” protocol update has been enacted by the validator set and is now live on the Radix Public Network and the Stokenet test network."
seoDescription: null
featured: true
showToc: false
archived: false
draft: false
bodyFormat: "html"
image:
  src: "/assets/6762a45395c8d9ba009c1776_Cuttlefish-Live-on-Mainnet.png"
  alt: null
video: null
legacy:
  id: "6762a472169599a3c8aa7e51"
  createdAt: "2024-12-18T10:31:14.936Z"
  updatedAt: "2024-12-18T10:54:21.886Z"
  publishedAt: "2024-12-18T10:54:21.886Z"
---

<p id="">The “Cuttlefish” protocol update has been enacted by the validator set and is now live on the Radix Public Network and the Stokenet test network.</p><p id="">The headline feature of Cuttlefish is <a id="" href="https://docs.radixdlt.com/docs/pre-authorizations-and-subintents"><strong id="">subintents</strong></a><strong id=""> </strong>(called pre-authorizations in the Radix Wallet), which function like mini transactions that can be embedded within other transactions. They are complete user intents which are signed separately and can be passed around off-ledger to be assembled with other intents into a complete transaction.</p><h2 id=""><strong id="">The Power of Subintents</strong></h2><p id="">Subintents enable a wide variety of interesting use cases where different actors can sign parts of a transaction that they’re interested in, with an expectation that another part of the transaction will handle getting their desired outcome.</p><p id="">Each subintent in a transaction exists within its own “walled garden,” so there’s no unintended sharing of permissions with other parts of the transaction, and subintents can pass resources back and forth with their parent (and children, if any) during execution.</p><p id="">The Radix “all-or-nothing” guarantee of transaction execution remains in place: all instructions in all subintents must fully execute successfully or the entire transaction will fail, so users are always assured that they won’t wind up with only part of their intent.</p><p id=""><a id="" href="https://youtu.be/o6ICClOCTFM">Check out this video</a> of RDX Works CPO Matthew Hine explaining how subintents work and going into some sample use cases.</p><p id="">Developers may want to review the <a id="" href="https://docs.radixdlt.com/docs/subintents">technical reference documentation</a> on subintents, as well as the freshly-overhauled general <a id="" href="https://docs.radixdlt.com/transaction-overview">transaction documentation</a>.</p><h2 id=""><strong id="">Throughput Improvements</strong></h2><p id="">Transaction benchmarking revealed some low-hanging fruit for performance improvement which was worked in for Cuttlefish.&nbsp; Please note that this is separate from the still-to-come, more comprehensive effort on looking at ways to maximize throughput.</p><h2 id=""><strong id="">Scrypto Updates</strong></h2><p id="">Radix has supported ECDSA/secp256k1 and EdDSA/Ed25519 for transaction signing since the Babylon release, and now the related primitives for verification are also available <a id="" href="https://docs.radixdlt.com/docs/scrypto-v1-3-0#more-crypto-utils">directly in Scrypto</a>, for those wishing to do so within on-ledger components at native speed &amp; cost.</p><p id="">The <a id="" href="https://docs.radixdlt.com/docs/account">Account blueprint</a> has been updated to expose <a id="" href="https://docs.radixdlt.com/docs/scrypto-v1-3-0#getter-methods-on-account-blueprint">getter methods</a> for balances for use cases where producing Proofs of amounts is not desired.</p><p id="">Please see the <a id="" href="https://docs.radixdlt.com/docs/scrypto-v1-3-0">complete release notes</a> for the full set of changes.</p>
