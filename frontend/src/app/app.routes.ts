import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/rooms', pathMatch: 'full' },
  {
    path: 'rooms',
    loadComponent: () =>
      import('./rooms/rooms.component').then((m) => m.RoomsComponent),
  },
  {
    path: 'chat/:roomId',
    loadComponent: () =>
      import('./chat/chat.component').then((m) => m.ChatComponent),
  },
  { path: '**', redirectTo: '/rooms' },
];
