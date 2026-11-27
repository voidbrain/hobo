# Places and trips manual checks

These checks use the local Hobo app and a neutral test place. Keep both processes running in separate terminals.

```sh
npm run server
```

Expected: the terminal prints `Hobo server on http://127.0.0.1:4310`.

```sh
npm start
```

Expected: Angular serves the app at `http://localhost:4200` and proxies `/api` to the local service.

## F-002-T02 — Place list and form

1. Open `http://localhost:4200/places` and choose **Add place**.
2. Leave every field blank except **Name**; enter `Test place 01` and choose **Save place**.
3. Confirm the place appears in the list. Choose **Edit Test place 01**.
4. Enter a description, category `Test`, tags `day trip, lake`, notes `Manual check`, and choose **2 h** for time on site. Save.
5. Reload the page, edit the place again, and confirm those values remain. Confirm the list shows the description, category and tags.
6. Repeat with the keyboard: tab to **Add place**, submit an empty form, and confirm the name error is announced and the form remains open. Enter a name and save; confirm focus can reach the edit button and all fields.

Expected: a name alone creates a place; optional fields save and reload; the name is required; keyboard users can operate the form and receive the validation error.

## F-002-T04 — Place location

1. Edit `Test place 01` and enter at least three characters of a known place name in **Search for a place**.
2. Choose a result. Confirm the map shows its marker and the selected coordinates.
3. Save, reload the page, and edit the place again. Confirm the marker and coordinates remain.
4. Click a different point on the map. Confirm the marker moves and the selected coordinates change; save and reload once more.

Expected: autocomplete suggestions come from the configured local map provider, a result or map click sets the place location, and the selected coordinates persist. Search requires a working geocoding provider in the local server configuration.
