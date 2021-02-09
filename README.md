Substation DIY
==============
Substation lets you make a club or newsletter using your own accounts on services like Braintree and 
Mailgun. It's free, open-source, and easy to set up.
   
Getting started
---------------
Once you have your accounts at Braintree and Mailgun you just need to edit the `.env` file in your Glitch project.

Here it is, step-by-step:

  - Add an admin email and set the title and main URL (your glitch URL)
    - `ADMIN_EMAIL=hello@substation.dev`
    - `TITLE=Substation`
    - `URL=https://substation.glitch.me/`
  - Set the security secret. This can be anything no one will guess. Mash the keyboard even!
    - `SECURITY_SECRET=what3verYouwant!keepitSECRE7`
  - Finally, you need to add information from Braintree and Mailgun. Both need API keys and 
    secrets. Mailgun needs a 'FROM' email address, and Braintree needs you to set up a 
    subscription and add its ID, set the environment as `Sandbox` or `Production`,
    and give a minimum amount for your monthly membership fee.

Logging In
----------
The admin dashboard is located at your.site/dashboard — login there to see
current subscriber stats, get your embed code, export a member list, or send email.

Customizing the page and embed
------------------------------
You can add fully custom templates and CSS for the embed, emails, and the main index
page. They each have corresponding files in the `/views` folder, but make a copy in your
`/config` folder so you'll have all your changes in one place. Substation will use your
files instead of the defaults, and later if you upgrade of move to a new webhost you
only have to copy your `.env` file and the `/config` folder.

Create a folder called `/config` at the top level of the app
  - For a custom homepage, create a file called `/config/views/index.html` — 
    this will be shown instead of the default page
  - To add CSS create `/config/public/custom.css` — 
    you can access this file as `/customcss` from the domain root to include it in an html file
  - You can also customize the email templates — 
    - `/config/views/email.html` for the main email template
    - `/config/views/messages/login.html`, unsubscribe.html, and welcome.html
      (For these we suggest starting with a copy of the default templates
      that are located in the main /views folder)

Project structure
-----------------
Substation on Glitch is pretty minimal: a basic Node+Express setup, Braintree for payment 
processing and storing subscriber details, Mailgun for email, and our own Lodge UI kit
for the overlays and checkout flow.

  - [Braintree](https://developers.braintreepayments.com/)
  - [Mailgun](https://documentation.mailgun.com/en/latest/)
  - [Lodge](https://lodge.substation.dev/)
  
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

Updating
--------
As long as you've used the config/ folder for all customizations, as covered in the Getting
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
[@jessevondoom](https://twitter.com/jessevondoom), [@alanmoo](https://github.com/alanmoo), [@gmiddleb](https://github.com/gmiddleb)



¯\\_(ツ)_/¯
-----------
