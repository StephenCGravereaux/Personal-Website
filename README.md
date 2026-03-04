# Stephen Gravereaux Personal Website

Professional multi-page personal website built from resume details, including publication, dedicated project pages, and profile image sections.

## Local preview

Open `index.html` directly in your browser.

## Publish to GitHub Pages

1. Create a GitHub repository and push this folder to the `main` branch.
2. In GitHub, go to `Settings` -> `Pages`.
3. Set source to `GitHub Actions`.
4. Push changes to `main`; workflow `.github/workflows/deploy-pages.yml` will deploy automatically.
5. Your site will be available at:
   - `https://<your-github-username>.github.io/<repo-name>/`

## Files

- `index.html`: main page content
- `projects.html`: projects and research page
- `cafe-lab-project.html`: dedicated CAFE LAB project page
- `crypto-lab-project.html`: dedicated CRYPTO CRYPTOGRAPHY LAB project page
- `twitch-chatbot-project.html`: dedicated automated AI Twitch chatbot project page
- `styles.css`: theme and responsive design
- `main.js`: reveal animation and current year
- `assets/profile-photo.jpeg`: profile image
- `.github/workflows/deploy-pages.yml`: auto-deployment pipeline
