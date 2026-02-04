"""
URL configuration for the Feed API.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'posts', views.PostViewSet, basename='post')
router.register(r'comments', views.CommentViewSet, basename='comment')

urlpatterns = [
    path('', include(router.urls)),
    path('leaderboard/', views.LeaderboardView.as_view(), name='leaderboard'),
    
    # Auth endpoints
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/me/', views.current_user, name='current-user'),
    
    # Legacy endpoint
    path('users/me/', views.current_user, name='current-user-legacy'),
]
