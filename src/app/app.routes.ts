import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then((m) => m.Home), title: 'Hobo' },
  {
    path: 'places',
    loadComponent: () => import('./pages/places/places-page').then((m) => m.PlacesPage),
    title: 'Places · Hobo',
  },
  { path: '**', redirectTo: '' },
];
