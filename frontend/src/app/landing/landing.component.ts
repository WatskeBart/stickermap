import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';


@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
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
