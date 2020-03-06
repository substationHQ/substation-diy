Substation
==========
Using Braintree, Mailgun, and a little bit of glue to build a basic subscription / fan club.
   
  
Project structure
-----------------
Substation on Glitch is pretty minimal: a basic Node+Express setup, Braintree for payment 
processing and storing subscriber details, Mailgun for email, and our own Lodge UI kit
for the overlays and checkout flow.

  - [Braintree](https://developers.braintreepayments.com/)
  - [Mailgun](https://documentation.mailgun.com/en/latest/)
  - [Lodge](https://lodge.glitch.me/)
  
Most of the project settings are in the .env file — the idea being that anyone who wants to
remix Substation needs only edit the .env with their own Braintree/Mailgun keys and a few 
details to get started. 

The package.json file sets up the server envoronment, installs NPM modules, etc. The actual 
server lives in server.js — a mostly simple setup and simple in structure. In time we probably 
want to refactor with a few external objects but as of now it's working as a single script. 
All views are kept in the views/ folder, while static public files are hosted in the public/
folder. (They resolve to root, so "public/sample.css" is referenced just as "/sample.css" in 
any view/HTML.)

Lastly, the overlays all live as part of the Lodge library. They're made to be responsive and
secure cross-domain, so ultimately we'll host stable versions of Lodge on a CDN.

Getting started
---------------
See the detault index.html view — it's the default page that you see when you launch a new
page! It steps you through setting up the .env file, customizing the pages, using the embed,
and a few other helpful tips.

Collaborating on Glitch
-----------------------
Glitch, while based on git, is different from a traditional git development environment. The
editor works more like Google Docs. To contribute to the project, for now, you must be a member
of the Substation team on Glitch. Any work done to the main project is saved and redeployed in 
real-time as we work on it.

Nutshell: it'll take some getting used to, but it's great for a first sprint. We're working on 
setting up a github account for two-way sync and storing release candidates.

Misc details:
  - Tools are a little ard to find, but look below the file list to the left. The "Tools ^" 
    button is your friend. You'll find the server logs, debugger, and more
  - The << rewind button to the left of Tools will help you get back to a previous state 
    if something goes wrong — literally browse through git commits
  - The server is in a constant state of commit-and-redeploy. It's weird at first, but just
    means that the test domain, substation.glitch.me is constantly at the latest code level
  - If you're working in the same file as someone else you won't overwrite their work unless
    you're on the same lines. Be good, talk on Slack, and all will be well

Credits
-------
[@jessevondoom](https://twitter.com/jessevondoom), [@gmiddleb](https://github.com/gmiddleb)



¯\\_(ツ)_/¯
-----------