// src/spotify.js

const clientId = '7ef3255f2dae47e6b0acf71ba89dcc91';
const redirectUri = window.location.origin + '/'; 

// These "scopes" tell Spotify exactly what permissions we need
const scopes = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-currently-playing'
];

export const authEndpoint = "https://accounts.spotify.com/authorize";

// This builds the long URL that opens the "Allow Access" popup
export const loginUrl = `${authEndpoint}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join("%20")}&response_type=token&show_dialog=true`;

// This function pulls the "Access Token" out of the URL after you log in
export const getTokenFromUrl = () => {
  return window.location.hash
    .substring(1)
    .split('&')
    .reduce((initial, item) => {
      let parts = item.split('=');
      initial[parts[0]] = decodeURIComponent(parts[1]);
      return initial;
    }, {});
};