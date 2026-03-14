import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [MatCardModule, MatButtonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  constructor(private router: Router, public authService: AuthService) {}

  navigateToMap(): void {
    this.router.navigate(['/map']);
  }

  navigateToAddSticker(): void {
    this.router.navigate(['/add-sticker']);
  }
}
