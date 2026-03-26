from django.urls import path
from . import views

app_name = 'navigation_app'

urlpatterns = [
    path('', views.index, name='index'),
    path('api/search-postes/', views.api_search_postes, name='api_search_postes'),
    path('api/poste-detail/', views.api_poste_detail, name='api_poste_detail'),
]
