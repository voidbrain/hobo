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
6. Repeat with the keyboard: tab to **Add place**, submit an empty form, and confirm the name field has an invalid state and the required-name error is announced with the danger colour and icon; the form remains open. Enter a name and save; confirm focus can reach the edit button and all fields.

Expected: a name alone creates a place; optional fields save and reload; the name is required; keyboard users can operate the form and receive the validation error.

## F-002-T04 — Place location

1. Ensure `server/config.local.json` exists. If it does not, copy `server/config.example.json` to that path; set `openRouteServiceApiKey` to your OpenRouteService key and restart the server. The file is git-ignored. OSRM does not support place search.
2. To check the missing-key guidance, temporarily leave `openRouteServiceApiKey` empty and restart the server. Search for `Treviso` and confirm the message says place search needs an OpenRouteService key and points to the local config and README. Restore the key and restart the server.
3. Edit `Test place 01` and enter `Treviso` in **Search for a place**. With the keyboard, choose a result and confirm focus returns to search and the selected coordinates are announced.
4. Save, reload the page, and edit the place again. Confirm the marker and coordinates remain.
5. On the untouched world view, choose **Use map centre** with the keyboard. Confirm no location is selected and the message says to zoom in to a local area first. Zoom to level 10 or closer and choose the button again; confirm the marker moves and the selected coordinates change. Save and reload once more. A pointer click on another map point should also update the marker and coordinates.

Expected: autocomplete suggestions come from OpenRouteService, the missing-key message identifies the setting to configure, a result or map click sets the place location, and the selected coordinates persist. The map-centre control refuses world-scale coordinates until zoom level 10.

## F-002-T05 — Categories and tags

1. Create or edit three test places: set two to category `Culture`, give one of those the tags `family, outdoors`, give the other `museum`, and leave the third without a category or tags.
2. Set **Category** to `Culture` and **Tag** to `family`. Confirm only the matching place remains. Choose **All tags**, then set **Group by** to **Tag**. Confirm places appear under their tag names and the untagged place appears under **No tags**.
3. Open **Manage categories and tags**. Choose **Category**, select `Culture`, choose **Rename**, enter `Arts`, and choose **Apply to places**. Confirm both places now show `Arts` and the success message announces the number updated.
4. Choose **Tag**, select `museum`, choose **Merge**, and select `family`. Confirm the affected place now has `family` once. Choose **Delete and reassign**, select `outdoors`, and reassign it to `family`. Confirm that place now has `family` once.
5. Reload the page and confirm category and tag changes remain. Repeat the controls with the keyboard and confirm the success message is announced.

Expected: category and tag filters combine, groups include unassigned places, rename and merge update all uses, tag merges do not duplicate values, and clearing a value removes it from every affected place.
