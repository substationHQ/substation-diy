Substation DIY
==============
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

The package.json file sets up the server environment, installs NPM modules, etc. The actual 
server lives in server.js — a mostly simple setup and simple in structure. In time we probably 
want to refactor with a few external objects but as of now it's working as a single script. 
All views are kept in the views/ folder, while static public files are hosted in the public/
folder. (They resolve to root, so "public/sample.css" is referenced just as "/sample.css" in 
any view/HTML.)

Lastly, the overlays all live as part of the Lodge library. They're made to be responsive and
secure cross-domain, so ultimately we'll host stable versions of Lodge on a CDN.

Getting started
---------------
See the default index.html view — it's the default page that you see when you launch a new
page! It steps you through setting up the .env file, customizing the pages, using the embed,
and a few other helpful tips.

The getting started guide is also available at the 
[/docs/gettingstarted](https://substation.glitch.me/docs/gettingstarted) route in your 
Substation DIY app.

Updating
--------
As long as you've used the .config/ folder for all customizations, as covered in the Getting
Started docs, you can easily update to the latest version of Substation on Glitch. Just click
the "Tools ^" button in the lower left corner of the Glitch editor, now select "Git, Import,
and Export", then "Import from Github", and use the repo "substation-me/substation-diy" when
prompted.

Collaborating on Glitch
-----------------------
Glitch, while based on git, is different from a traditional git development environment. The
editor works more like Google Docs. To contribute to the project, for now, you must be a member
of the Substation team on Glitch. Any work done to the main project is saved and redeployed in 
real-time as we work on it.

Nutshell: it'll take some getting used to, but it's great for a first sprint. We're working on 
setting up a github account for two-way sync and storing release candidates.

Misc details:
  - Tools are a little hard to find, but look below the file list to the left. The "Tools ^" 
    button is your friend. You'll find the server logs, debugger, and more
  - The << rewind button to the left of Tools will help you get back to a previous state 
    if something goes wrong — literally browse through git commits
  - The server is in a constant state of commit-and-redeploy. It's weird at first, but just
    means that the test domain, substation.glitch.me is constantly at the latest code level
  - If you're working in the same file as someone else you won't overwrite their work unless
    you're on the same lines. Be good, talk on Slack, and all will be well

Development
-----------
The make development easier you can run substation DIY locally, but there are a few steps.
First, you'll need a .env file set up and ready, with the values from the .env teamplate. With
that in place, things will still break. You'll need to be running ssl on localhost. We've taken
care of a lot of that, but you'll need to add a self-signed certificate and know a couple 
tricks on the command line. Assuming mac/linux, open up a shell in the repo and run:

  - `mkdir ./config` then `cd ./config` 
  - `openssl req -x509 -newkey rsa:2048 -keyout tmp.pem -out cert.pem -days 365`
  - `openssl rsa -in tmp.pem -out key.pem`
  - `rm tmp.pem`

Nutshell: we do a lot of work in the config/ folder. It's not tracked in the repo because 
everything in it is custom. If you have a config folder already you don't need to recreate it.
Those two openssl commands create a self-signed ssl certificate substation can use to serve 
pages via https right away. Once those files are in place just head back to the main repo folder
and type `npm run dev`.

You'll get a warning error in your browser. Just tell it to trust you. If you're using Chrome
you might want to try entering this in the url bar: `chrome://flags/#allow-insecure-localhost`.
From there you can set Chrome to allow insecure content. It's not always enough, so if you still
see a warning page saying ERR_CERT_INVALID you might need to do the silliest thing to get past
the warning. I kid you not: click in the browser window, type "thisisunsafe" and hit enter.

LOL yeah it's real.

Credits
-------
[@jessevondoom](https://twitter.com/jessevondoom), [@gmiddleb](https://github.com/gmiddleb)



¯\\_(ツ)_/¯
-----------
